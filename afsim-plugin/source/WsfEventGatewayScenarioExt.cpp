// WsfEventGatewayScenarioExt.cpp

#include "WsfEventGatewayScenarioExt.hpp"

#include "UtInput.hpp"
#include "UtInputBlock.hpp"
#include "UtMemory.hpp"
#include "WsfScenario.hpp"
#include "WsfSimulation.hpp"
#include "WsfEventGatewaySimExt.hpp"

namespace wsf
{
namespace gateway
{

ScenarioExtension::ScenarioExtension()
   : WsfScenarioExtension()
{
}

ScenarioExtension* ScenarioExtension::Find(const WsfScenario& aScenario)
{
   return static_cast<ScenarioExtension*>(aScenario.FindExtension("event_gateway"));
}

void ScenarioExtension::SimulationCreated(WsfSimulation& aSimulation)
{
   aSimulation.RegisterExtension(GetExtensionName(),
      ut::make_unique<SimulationExtension>(*this));
}

bool ScenarioExtension::ProcessInput(UtInput& aInput)
{
   bool        myCommand = false;
   std::string command(aInput.GetCommand());

   if (command == "event_gateway")
   {
      myCommand = true;
      UtInputBlock inputBlock(aInput, "end_event_gateway");
      while (inputBlock.ReadCommand(command))
      {
         if (command == "enabled")
         {
            aInput.ReadValue(mEnabled);
         }
         else if (command == "event_pipe_name")
         {
            aInput.ReadValue(mEventPipeName);
         }
         else if (command == "control_pipe_name")
         {
            aInput.ReadValue(mControlPipeName);
         }
         else if (command == "mover_throttle")
         {
            aInput.ReadValueOfType(mMoverThrottle, UtInput::cTIME);
            if (mMoverThrottle < 0.0)
            {
               throw UtInput::BadValue(aInput, "mover_throttle must be >= 0");
            }
         }
         else
         {
            throw UtInput::UnknownCommand(aInput);
         }
      }
   }
   return myCommand;
}

} // namespace gateway
} // namespace wsf
