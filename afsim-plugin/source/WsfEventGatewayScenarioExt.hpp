// WsfEventGatewayScenarioExt.hpp - Scenario extension for event_gateway

#ifndef WSFEVENTGATEWAYSCENARIOEXT_HPP
#define WSFEVENTGATEWAYSCENARIOEXT_HPP

#include <string>

#include "WsfScenarioExtension.hpp"

namespace wsf
{
namespace gateway
{

//! Reads event_gateway configuration from scenario input and creates the
//! simulation extension when a simulation is created.
class ScenarioExtension : public WsfScenarioExtension
{
public:
   ScenarioExtension();

   static ScenarioExtension* Find(const WsfScenario& aScenario);

   void SimulationCreated(WsfSimulation& aSimulation) override;
   bool ProcessInput(UtInput& aInput) override;

   bool              IsEnabled()            const { return mEnabled; }
   const std::string& GetEventPipeName()    const { return mEventPipeName; }
   const std::string& GetControlPipeName()  const { return mControlPipeName; }
   double             GetMoverThrottle()    const { return mMoverThrottle; }

private:
   bool        mEnabled{true};
   std::string mEventPipeName{"afsim_events"};
   std::string mControlPipeName{"afsim_control"};
   double      mMoverThrottle{0.1}; // seconds between mover updates per platform
};

} // namespace gateway
} // namespace wsf

#endif
