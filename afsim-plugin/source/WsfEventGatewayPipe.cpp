// WsfEventGatewayPipe.cpp

#include "WsfEventGatewayPipe.hpp"

#include <iostream>

#ifndef _WIN32
#error "WsfEventGatewayPipe currently requires Windows named pipes"
#endif

// Minimize Windows header exposure
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include "google/protobuf/message_lite.h"

namespace wsf
{
namespace gateway
{

// ============================================================================
// EventPipeQueue
// ============================================================================

EventPipeQueue::EventPipeQueue(size_t aCapacity)
{
   // Round up to power-of-two for fast modulo
   size_t cap = 1;
   while (cap < aCapacity) cap <<= 1;
   mRing = std::make_unique<Entry[]>(cap);
   mCapacity = cap;
   mMask = cap - 1;
}

bool EventPipeQueue::TryPush(const std::string& aSerialized, EventType aType)
{
   size_t head = mHead.load(std::memory_order_relaxed);
   size_t tail = mTail.load(std::memory_order_acquire);
   if (head - tail >= mCapacity)
   {
      return false; // full
   }
   Entry& e = mRing[head & mMask];
   e.mData = aSerialized;
   e.mType = aType;
   e.mWritten.store(true, std::memory_order_release);
   mHead.store(head + 1, std::memory_order_release);
   return true;
}

bool EventPipeQueue::TryPop(std::string& aOut)
{
   size_t tail = mTail.load(std::memory_order_relaxed);
   Entry& e = mRing[tail & mMask];
   if (!e.mWritten.load(std::memory_order_acquire))
   {
      return false; // empty
   }
   if (e.mDropped.load(std::memory_order_acquire))
   {
      // Entry was dropped - skip it
      aOut.clear();
   }
   else
   {
      aOut = std::move(e.mData);
   }
   e.mWritten.store(false, std::memory_order_relaxed);
   e.mDropped.store(false, std::memory_order_relaxed);
   mTail.store(tail + 1, std::memory_order_release);
   return true;
}

void EventPipeQueue::DropOldestMover()
{
   // Scan from tail forward, looking for a mover_updated entry.
   // We set an atomic dropped flag so the writer thread skips it.
   // This avoids a data race on the mData string.
   size_t head = mHead.load(std::memory_order_relaxed);
   size_t tail = mTail.load(std::memory_order_relaxed);
   for (size_t i = tail; i < head; ++i)
   {
      Entry& e = mRing[i & mMask];
      if (e.mWritten.load(std::memory_order_acquire) &&
          e.mType == cMOVER_UPDATED &&
          !e.mDropped.load(std::memory_order_acquire))
      {
         e.mDropped.store(true, std::memory_order_release);
         return; // only drop one
      }
   }
}

// ============================================================================
// EventPipeWriter
// ============================================================================

EventPipeWriter::EventPipeWriter() = default;

EventPipeWriter::~EventPipeWriter()
{
   Close();
}

bool EventPipeWriter::Open(const std::string& aPipeName)
{
   std::string fullPath = "\\\\.\\pipe\\" + aPipeName;

   mPipeHandle = CreateNamedPipeA(
      fullPath.c_str(),
      PIPE_ACCESS_OUTBOUND | FILE_FLAG_OVERLAPPED,
      PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
      1,            // max instances
      65536,        // out buffer size
      0,            // in buffer size
      0,            // default timeout
      nullptr);     // default security

   if (mPipeHandle == INVALID_HANDLE_VALUE)
   {
      std::cerr << "wsf_event_gateway: Failed to create pipe " << fullPath
                << " (error " << GetLastError() << ")\n";
      mPipeHandle = nullptr;
      return false;
   }

   std::cerr << "wsf_event_gateway: Created pipe " << fullPath << " successfully\n";

   // Start the writer thread - it will wait for client connection before
   // draining the queue. This ensures the sim thread is never blocked.
   mRunning.store(true, std::memory_order_release);
   mWriterThread = std::thread(&EventPipeWriter::WriterThreadFunc, this);

   return true;
}

void EventPipeWriter::Write(const google::protobuf::MessageLite& aMsg, bool aIsMoverUpdate)
{
   if (!mRunning.load(std::memory_order_acquire))
   {
      return;
   }

   std::string serialized;
   serialized.resize(aMsg.ByteSizeLong());
   if (!aMsg.SerializeToArray(&serialized[0], static_cast<int>(serialized.size())))
   {
      return;
   }

   EventPipeQueue::EventType evtType = aIsMoverUpdate ?
      EventPipeQueue::cMOVER_UPDATED : EventPipeQueue::cOTHER;

   if (!mQueue.TryPush(serialized, evtType))
   {
      mQueue.DropOldestMover();
      // Try once more after making room
      if (!mQueue.TryPush(serialized, evtType))
      {
         // Still full - drop this event entirely
      }
   }
}

void EventPipeWriter::Close()
{
   mRunning.store(false, std::memory_order_release);
   if (mWriterThread.joinable())
   {
      mWriterThread.join();
   }
   if (mPipeHandle)
   {
      // Cancel pending I/O so ConnectNamedPipe/WriteFile can unblock
      CancelIoEx(mPipeHandle, nullptr);
      FlushFileBuffers(mPipeHandle);
      DisconnectNamedPipe(mPipeHandle);
      CloseHandle(mPipeHandle);
      mPipeHandle = nullptr;
   }
}

void EventPipeWriter::WriterThreadFunc()
{
   // Wait for a client to connect on this background thread so we don't
   // block the simulation thread.
   OVERLAPPED ov = {};
   ov.hEvent = CreateEvent(nullptr, TRUE, FALSE, nullptr);
   BOOL connected = ConnectNamedPipe(mPipeHandle, &ov);

   if (!connected && GetLastError() != ERROR_IO_PENDING)
   {
      if (GetLastError() != ERROR_PIPE_CONNECTED)
      {
         std::cerr << "wsf_event_gateway: ConnectNamedPipe failed (error "
                   << GetLastError() << ")\n";
         mRunning.store(false, std::memory_order_release);
         CloseHandle(ov.hEvent);
         return;
      }
   }

   if (GetLastError() == ERROR_IO_PENDING)
   {
      // Wait with periodic checks of mRunning so Close() can unblock us
      while (mRunning.load(std::memory_order_acquire))
      {
         DWORD waitResult = WaitForSingleObject(ov.hEvent, 1000);
         if (waitResult == WAIT_OBJECT_0)
         {
            break; // client connected
         }
         // WAIT_TIMEOUT - check mRunning again
      }
   }
   CloseHandle(ov.hEvent);

   if (!mRunning.load(std::memory_order_acquire))
   {
      return; // Shutting down before client connected
   }

   // Client connected - drain the queue
   while (mRunning.load(std::memory_order_acquire) || !mQueue.Empty())
   {
      std::string msg;
      if (!mQueue.TryPop(msg))
      {
         // Queue empty - brief yield to avoid busy-spin
         Sleep(1);
         continue;
      }

      // Skip entries that were zeroed by DropOldestMover
      if (msg.empty())
      {
         continue;
      }

      // Wire format: 4-byte little-endian length prefix + protobuf payload
      uint32_t len = static_cast<uint32_t>(msg.size());
      uint8_t  hdr[4];
      hdr[0] = static_cast<uint8_t>(len & 0xFF);
      hdr[1] = static_cast<uint8_t>((len >> 8) & 0xFF);
      hdr[2] = static_cast<uint8_t>((len >> 16) & 0xFF);
      hdr[3] = static_cast<uint8_t>((len >> 24) & 0xFF);

      if (!WriteRaw(hdr, 4) || !WriteRaw(msg.data(), msg.size()))
      {
         // Pipe write failed - client likely disconnected.
         // In a production system we'd attempt re-creation; for now, stop.
         break;
      }
   }
}

bool EventPipeWriter::WriteRaw(const void* aData, size_t aLen)
{
   const char* p = static_cast<const char*>(aData);
   size_t      remaining = aLen;
   while (remaining > 0)
   {
      DWORD written = 0;
      // Synchronous write since we're on our own thread
      if (!WriteFile(mPipeHandle, p, static_cast<DWORD>(remaining), &written, nullptr))
      {
         return false;
      }
      p += written;
      remaining -= written;
   }
   return true;
}

} // namespace gateway
} // namespace wsf
