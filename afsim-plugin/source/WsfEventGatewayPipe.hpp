// WsfEventGatewayPipe.hpp - Named pipe writer for Protobuf over pipe

#ifndef WSFEVENTGATEWAYPIPE_HPP
#define WSFEVENTGATEWAYPIPE_HPP

#include <atomic>
#include <cstdint>
#include <memory>
#include <string>
#include <thread>

namespace google
{
namespace protobuf
{
class MessageLite;
}
}

namespace wsf
{
namespace gateway
{

//! Lock-free SPSC queue for pushing serialized protobuf messages from the
//! simulation thread to the pipe writer thread.  If the queue is full the
//! caller can request that the oldest MOVER_UPDATED entry be dropped rather
//! than blocking.
class EventPipeQueue
{
public:
   //! Event type tags used to identify mover_updated events for dropping
   enum EventType : uint8_t
   {
      cOTHER         = 0,
      cMOVER_UPDATED = 1
   };

   explicit EventPipeQueue(size_t aCapacity = 4096);

   //! Try to push a serialized message with an event type tag.
   //! Returns false if the queue is full.
   bool TryPush(const std::string& aSerialized, EventType aType = cOTHER);

   //! Try to pop a message.  Returns false if the queue is empty.
   bool TryPop(std::string& aOut);

   //! Drop the oldest entry tagged as a mover_updated event.
   //! This is called from the simulation thread when TryPush fails,
   //! to avoid blocking.
   void DropOldestMover();

   bool Empty() const { return mHead.load(std::memory_order_relaxed) == mTail.load(std::memory_order_relaxed); }

private:
   struct Entry
   {
      std::atomic<bool> mWritten{false};
      std::atomic<bool> mDropped{false};
      EventType         mType{cOTHER};
      std::string       mData;

      Entry() = default;
      // No copy/move — atomic members are not movable in MSVC
      Entry(const Entry&) = delete;
      Entry& operator=(const Entry&) = delete;
   };

   // Use unique_ptr to raw array to avoid vector reallocation issues
   // with std::atomic members (deleted move constructor on MSVC)
   std::unique_ptr<Entry[]> mRing;
   size_t                   mCapacity{0};
   size_t                   mMask{0};
   alignas(64) std::atomic<size_t> mHead{0};
   alignas(64) std::atomic<size_t> mTail{0};
};

//! Creates a Windows named pipe and writes length-prefixed protobuf messages
//! from a background thread fed by an EventPipeQueue.
class EventPipeWriter
{
public:
   EventPipeWriter();
   ~EventPipeWriter();

   //! Create the named pipe and start the writer thread.
   //! @param aPipeName  Pipe name without the \\.\pipe\ prefix.
   //! @return true on success.
   bool Open(const std::string& aPipeName);

   //! Enqueue a protobuf message for async write.  Never blocks the caller;
   //! if the queue is full, drops the oldest mover_updated event.
   //! @param aIsMoverUpdate  true if this is a mover_updated event (eligible for drop)
   void Write(const google::protobuf::MessageLite& aMsg, bool aIsMoverUpdate = false);

   //! Shut down the writer thread and close the pipe.
   void Close();

private:
   void WriterThreadFunc();
   bool WriteRaw(const void* aData, size_t aLen);

   EventPipeQueue   mQueue;
   void*            mPipeHandle{nullptr}; // HANDLE, void* to avoid windows.h in header
   std::thread      mWriterThread;
   std::atomic<bool> mRunning{false};
};

} // namespace gateway
} // namespace wsf

#endif
