// WsfEventGatewayPlugin.cpp - DLL entry points for the event_gateway WSF plugin

#include "UtMemory.hpp"
#include "UtPlugin.hpp"
#include "WsfApplication.hpp"
#include "WsfApplicationExtension.hpp"
#include "WsfPlugin.hpp"
#include "WsfEventGatewayScenarioExt.hpp"

extern "C"
{

UT_PLUGIN_EXPORT void WsfPluginVersion(UtPluginVersion& aVersion)
{
   aVersion = UtPluginVersion(WSF_PLUGIN_API_MAJOR_VERSION,
                              WSF_PLUGIN_API_MINOR_VERSION,
                              WSF_PLUGIN_API_COMPILER_STRING);
}

UT_PLUGIN_EXPORT void WsfPluginSetup(WsfApplication& aApplication)
{
   aApplication.RegisterFeature("event_gateway", "wsf_event_gateway");
   aApplication.RegisterExtension("event_gateway",
      ut::make_unique<WsfDefaultApplicationExtension<wsf::gateway::ScenarioExtension>>());
}

} // extern "C"
