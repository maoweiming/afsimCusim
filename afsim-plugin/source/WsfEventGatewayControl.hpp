// WsfEventGatewayControl.hpp - Control pipe reader (receives Go commands)

#ifndef WSFEVENTGATEWAYCONTROL_HPP
#define WSFEVENTGATEWAYCONTROL_HPP

#include <atomic>
#include <string>
#include <thread>

namespace wsf
{
namespace gateway
{

class SimulationExtension;

//! Reads ControlCommand protobuf messages from a Windows named pipe.
//! When a command arrives, posts a WsfEvent onto the simulation so the
//! command executes on the sim thread.
class ControlPipeReader
{
public:
   ControlPipeReader();
   ~ControlPipeReader();

   //! Create the named pipe and start the reader thread.
   //! @param aPipeName  Pipe name without the \\.\pipe\ prefix.
   //! @param aSimExt    Back-pointer to the SimulationExtension (for posting events).
   //! @return true on success.
   bool Open(const std::string& aPipeName, SimulationExtension* aSimExt);

   //! Shut down the reader thread and close the pipe.
   void Close();

private:
   void ReaderThreadFunc();
   bool ReadExact(void* aBuf, size_t aLen);
   void HandleCommand(const std::string& aSerialized);

   void*               mPipeHandle{nullptr}; // HANDLE
   std::thread         mReaderThread;
   std::atomic<bool>   mRunning{false};
   SimulationExtension* mSimExt{nullptr};
};

} // namespace gateway
} // namespace wsf

#endif
