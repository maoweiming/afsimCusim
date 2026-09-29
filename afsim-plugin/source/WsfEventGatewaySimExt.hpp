// WsfEventGatewaySimExt.hpp - Simulation extension that connects observers

#ifndef WSFEVENTGATEWAYSIMEXT_HPP
#define WSFEVENTGATEWAYSIMEXT_HPP

#include <map>
#include <string>

#include "UtCallbackHolder.hpp"
#include "WsfSimulationExtension.hpp"
#include "WsfStringId.hpp"

// Forward declarations for AFSIM types used in private method signatures
class WsfPlatform;
class WsfMover;
class WsfSensor;
class WsfSensorResult;
class WsfTrack;
class WsfLocalTrack;
class WsfWeaponEngagement;
class WsfFuel;
class WsfTask;

// Forward declaration for protobuf type
namespace afsim
{
namespace events
{
class PlatformData;
class TaskData;
}
}

namespace wsf
{
namespace gateway
{

class ScenarioExtension;
class EventPipeWriter;
class ControlPipeReader;

//! Simulation extension that hooks AFSIM observers and streams events
//! as Protobuf messages over a Windows named pipe.
class SimulationExtension : public WsfSimulationExtension
{
public:
   SimulationExtension(const ScenarioExtension& aConfig);
   ~SimulationExtension() override;

   static SimulationExtension* Find(const WsfSimulation& aSimulation);

   void AddedToSimulation() override;

   // Needed by ControlPipeReader to post events
   using WsfSimulationExtension::GetSimulation;

private:
   // --- Simulation lifecycle observers ---
   void OnSimulationStarting();
   void OnSimulationComplete(double aSimTime);
   void OnSimulationPausing();
   void OnSimulationResuming();
   void OnFrameComplete(double aSimTime);

   // --- Platform observers ---
   void OnPlatformAdded(double aSimTime, WsfPlatform* aPlatformPtr);
   void OnPlatformInitialized(double aSimTime, WsfPlatform* aPlatformPtr);
   void OnPlatformDeleted(double aSimTime, WsfPlatform* aPlatformPtr);
   void OnPlatformBroken(double aSimTime, WsfPlatform* aPlatformPtr);
   void OnPlatformDamageChanged(double aSimTime, WsfPlatform* aPlatformPtr);

   // --- Mover observer ---
   void OnMoverUpdated(double aSimTime, WsfMover* aMoverPtr);

   // --- Sensor observers ---
   void OnSensorTurnedOn(double aSimTime, WsfSensor* aSensorPtr);
   void OnSensorTurnedOff(double aSimTime, WsfSensor* aSensorPtr);
   void OnSensorDetectionChanged(double aSimTime, WsfSensor* aSensorPtr,
      size_t aTargetIndex, WsfSensorResult& aResult);
   void OnSensorTrackInitiated(double aSimTime, WsfSensor* aSensorPtr,
      const WsfTrack* aTrackPtr);
   void OnSensorTrackDropped(double aSimTime, WsfSensor* aSensorPtr,
      const WsfTrack* aTrackPtr);

   // --- Weapon observers (from wsf_mil) ---
   void OnWeaponFired(double aSimTime, const WsfWeaponEngagement* aEngagementPtr,
      const WsfTrack* aTargetTrackPtr);
   void OnWeaponHit(double aSimTime, const WsfWeaponEngagement* aEngagementPtr,
      WsfPlatform* aTargetPtr);
   void OnWeaponMissed(double aSimTime, const WsfWeaponEngagement* aEngagementPtr,
      WsfPlatform* aTargetPtr);
   void OnWeaponTerminated(double aSimTime, const WsfWeaponEngagement* aEngagementPtr);

   // --- Track observers ---
   void OnLocalTrackInitiated(double aSimTime, WsfPlatform* aPlatformPtr,
      const WsfLocalTrack* aTrackPtr, const WsfTrack* aSourcePtr);
   void OnLocalTrackUpdated(double aSimTime, WsfPlatform* aPlatformPtr,
      const WsfLocalTrack* aTrackPtr, const WsfTrack* aSourcePtr);
   void OnLocalTrackDropped(double aSimTime, WsfPlatform* aPlatformPtr,
      const WsfLocalTrack* aTrackPtr);

   // --- Comment observer ---
   void OnComment(double aSimTime, WsfPlatform* aPlatformPtr, const std::string& aText);

   // --- Fuel observer ---
   void OnFuelEvent(double aSimTime, WsfFuel* aFuelPtr, WsfStringId aEventNameId);

   // --- Task observers (WsfTaskManager) ---
   void OnTaskAssigned(double aSimTime, const WsfTask* aTaskPtr, const WsfTrack* aTrackPtr);
   void OnTaskCompleted(double aSimTime, const WsfTask* aTaskPtr, WsfStringId aStatus);
   void OnTaskCanceled(double aSimTime, const WsfTask* aTaskPtr);

   // Helper: populate a PlatformData protobuf from a WsfPlatform
   void FillPlatformData(afsim::events::PlatformData& aOut, WsfPlatform* aPlatformPtr);

   // Helper: populate a TaskData protobuf from a WsfTask
   void FillTaskData(afsim::events::TaskData& aOut, const WsfTask* aTaskPtr);

   const ScenarioExtension& mConfig;

   // Pipe writer for event stream
   EventPipeWriter*    mPipe{nullptr};
   // Control pipe reader
   ControlPipeReader*  mControl{nullptr};

   // Callback holder - disconnects all observers when extension is destroyed
   UtCallbackHolder    mCallbacks;

   // Mover throttle: minimum sim time between mover updates for a given platform
   std::map<size_t, double> mLastMoverTime; // platform index -> last send time
};

} // namespace gateway
} // namespace wsf

#endif
