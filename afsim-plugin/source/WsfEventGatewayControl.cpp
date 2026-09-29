// WsfEventGatewayControl.cpp

#include "WsfEventGatewayControl.hpp"
#include "WsfEventGatewaySimExt.hpp"

#include <cstdint>
#include <cstring>
#include <iostream>

#ifndef _WIN32
#error "WsfEventGatewayControl currently requires Windows named pipes"
#endif

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include "afsim_control.pb.h"
#include "WsfEvent.hpp"
#include "WsfSimulation.hpp"

namespace wsf
{
namespace gateway
{

// ---------------------------------------------------------------------------
// Custom WsfEvent subclasses that execute control commands on the sim thread
// ---------------------------------------------------------------------------

class PauseEvent : public WsfEvent
{
public:
   PauseEvent(double aSimTime, WsfSimulation* aSim)
      : WsfEvent(aSimTime), mSim(aSim) {}
   EventDisposition Execute() override
   {
      if (mSim) mSim->Pause();
      return cDELETE;
   }
private:
   WsfSimulation* mSim;
};

class ResumeEvent : public WsfEvent
{
public:
   ResumeEvent(double aSimTime, WsfSimulation* aSim)
      : WsfEvent(aSimTime), mSim(aSim) {}
   EventDisposition Execute() override
   {
      if (mSim) mSim->Resume();
      return cDELETE;
   }
private:
   WsfSimulation* mSim;
};

class SetClockRateEvent : public WsfEvent
{
public:
   SetClockRateEvent(double aSimTime, WsfSimulation* aSim, double aRate)
      : WsfEvent(aSimTime), mSim(aSim), mRate(aRate) {}
   EventDisposition Execute() override
   {
      if (mSim) mSim->SetClockRate(mRate);
      return cDELETE;
   }
private:
   WsfSimulation* mSim;
   double         mRate;
};

class TerminateEvent : public WsfEvent
{
public:
   TerminateEvent(double aSimTime, WsfSimulation* aSim)
      : WsfEvent(aSimTime), mSim(aSim) {}
   EventDisposition Execute() override
   {
      if (mSim) mSim->RequestTermination();
      return cDELETE;
   }
private:
   WsfSimulation* mSim;
};

class StepEvent : public WsfEvent
{
public:
   StepEvent(double aSimTime, WsfSimulation* aSim, double aStepTime)
      : WsfEvent(aSimTime), mSim(aSim), mStepTime(aStepTime) {}
   EventDisposition Execute() override
   {
      // AFSIM doesn't have a direct "step" API from WsfSimulation.
      // Step means: if paused, resume for aStepTime seconds then
      // pause again. We implement by resuming and scheduling a pause.
      if (mSim)
      {
         mSim->Resume();
         mSim->AddEvent(std::unique_ptr<WsfEvent>(
            new PauseEvent(mSim->GetSimTime() + mStepTime, mSim)));
      }
      return cDELETE;
   }
private:
   WsfSimulation* mSim;
   double         mStepTime;
};

// ---------------------------------------------------------------------------
// ControlPipeReader
// ---------------------------------------------------------------------------

ControlPipeReader::ControlPipeReader() = default;

ControlPipeReader::~ControlPipeReader()
{
   Close();
}

bool ControlPipeReader::Open(const std::string& aPipeName, SimulationExtension* aSimExt)
{
   mSimExt = aSimExt;
   std::string fullPath = "\\\\.\\pipe\\" + aPipeName;

   mPipeHandle = CreateNamedPipeA(
      fullPath.c_str(),
      PIPE_ACCESS_INBOUND | FILE_FLAG_OVERLAPPED,
      PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
      1,            // max instances
      0,            // out buffer size
      65536,        // in buffer size
      0,            // default timeout
      nullptr);     // default security

   if (mPipeHandle == INVALID_HANDLE_VALUE)
   {
      std::cerr << "wsf_event_gateway: Failed to create control pipe " << fullPath
                << " (error " << GetLastError() << ")\n";
      mPipeHandle = nullptr;
      return false;
   }

   // Start the reader thread - it will wait for client connection before
   // reading commands. This ensures the sim thread is never blocked.
   mRunning.store(true, std::memory_order_release);
   mReaderThread = std::thread(&ControlPipeReader::ReaderThreadFunc, this);

   return true;
}

void ControlPipeReader::Close()
{
   mRunning.store(false, std::memory_order_release);
   if (mPipeHandle)
   {
      // Cancel pending I/O so blocked reads can unblock
      CancelIoEx(mPipeHandle, nullptr);
   }
   if (mReaderThread.joinable())
   {
      mReaderThread.join();
   }
   if (mPipeHandle)
   {
      DisconnectNamedPipe(mPipeHandle);
      CloseHandle(mPipeHandle);
      mPipeHandle = nullptr;
   }
}

void ControlPipeReader::ReaderThreadFunc()
{
   // Wait for a client to connect on this background thread
   OVERLAPPED ov = {};
   ov.hEvent = CreateEvent(nullptr, TRUE, FALSE, nullptr);
   BOOL connected = ConnectNamedPipe(mPipeHandle, &ov);

   if (!connected && GetLastError() != ERROR_IO_PENDING)
   {
      if (GetLastError() != ERROR_PIPE_CONNECTED)
      {
         std::cerr << "wsf_event_gateway: ConnectNamedPipe (control) failed (error "
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
      }
   }
   CloseHandle(ov.hEvent);

   if (!mRunning.load(std::memory_order_acquire))
   {
      return; // Shutting down before client connected
   }

   // Client connected - read commands
   while (mRunning.load(std::memory_order_acquire))
   {
      // Read 4-byte little-endian length prefix
      uint8_t hdr[4];
      if (!ReadExact(hdr, 4))
      {
         break;
      }
      uint32_t len = hdr[0] | (hdr[1] << 8) | (hdr[2] << 16) | (hdr[3] << 24);
      if (len == 0 || len > 16 * 1024 * 1024)
      {
         std::cerr << "wsf_event_gateway: control pipe received invalid length " << len << "\n";
         break;
      }

      std::string payload(len, '\0');
      if (!ReadExact(&payload[0], len))
      {
         break;
      }

      HandleCommand(payload);
   }
}

bool ControlPipeReader::ReadExact(void* aBuf, size_t aLen)
{
   char*  p = static_cast<char*>(aBuf);
   size_t remaining = aLen;
   while (remaining > 0)
   {
      DWORD bytesRead = 0;
      if (!ReadFile(mPipeHandle, p, static_cast<DWORD>(remaining), &bytesRead, nullptr))
      {
         return false;
      }
      if (bytesRead == 0)
      {
         return false; // pipe closed
      }
      p += bytesRead;
      remaining -= bytesRead;
   }
   return true;
}

void ControlPipeReader::HandleCommand(const std::string& aSerialized)
{
   afsim::control::ControlCommand cmd;
   if (!cmd.ParseFromString(aSerialized))
   {
      std::cerr << "wsf_event_gateway: failed to parse ControlCommand\n";
      return;
   }

   if (!mSimExt)
   {
      return;
   }

   WsfSimulation* sim = &mSimExt->GetSimulation();
   double simTime = sim->GetSimTime();

   switch (cmd.command_case())
   {
   case afsim::control::ControlCommand::kPause:
      sim->AddEvent(std::unique_ptr<WsfEvent>(new PauseEvent(simTime, sim)));
      break;

   case afsim::control::ControlCommand::kResume:
      sim->AddEvent(std::unique_ptr<WsfEvent>(new ResumeEvent(simTime, sim)));
      break;

   case afsim::control::ControlCommand::kStep:
      sim->AddEvent(std::unique_ptr<WsfEvent>(
         new StepEvent(simTime, sim, cmd.step().step_time())));
      break;

   case afsim::control::ControlCommand::kSetClockRate:
      sim->AddEvent(std::unique_ptr<WsfEvent>(
         new SetClockRateEvent(simTime, sim, cmd.set_clock_rate().rate())));
      break;

   case afsim::control::ControlCommand::kTerminate:
      sim->AddEvent(std::unique_ptr<WsfEvent>(new TerminateEvent(simTime, sim)));
      break;

   default:
      std::cerr << "wsf_event_gateway: unknown control command\n";
      break;
   }
}

} // namespace gateway
} // namespace wsf
