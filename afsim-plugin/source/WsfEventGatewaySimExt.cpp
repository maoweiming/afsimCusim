// WsfEventGatewaySimExt.cpp - Connects AFSIM observers and streams Protobuf events

#include "WsfEventGatewaySimExt.hpp"
#include "WsfEventGatewayScenarioExt.hpp"
#include "WsfEventGatewayPipe.hpp"
#include "WsfEventGatewayControl.hpp"

#include <iostream>

#include "UtCallback.hpp"
#include "UtMemory.hpp"

#include "WsfPlatform.hpp"
#include "WsfSimulation.hpp"
#include "WsfScenario.hpp"
#include "WsfMover.hpp"
#include "WsfSensor.hpp"
#include "WsfSensorResult.hpp"
#include "WsfTrack.hpp"
#include "WsfLocalTrack.hpp"
#include "WsfFuel.hpp"

// Weapon observers are in wsf_mil
#include "WsfWeaponEngagement.hpp"
#include "WsfWeaponObserver.hpp"

// Other observers
#include "WsfPlatformObserver.hpp"
#include "WsfMoverObserver.hpp"
#include "WsfSensorObserver.hpp"
#include "WsfTrackObserver.hpp"
#include "WsfSimulationObserver.hpp"
#include "WsfFuelObserver.hpp"

// Task manager observers
#include "WsfTask.hpp"
#include "WsfTaskObserver.hpp"

// Generated protobuf headers
#include "afsim_events.pb.h"

namespace wsf
{
namespace gateway
{

// ============================================================================
// Construction / destruction
// ============================================================================

SimulationExtension::SimulationExtension(const ScenarioExtension& aConfig)
   : mConfig(aConfig)
{
}

SimulationExtension::~SimulationExtension()
{
   if (mControl)
   {
      mControl->Close();
      delete mControl;
      mControl = nullptr;
   }
   if (mPipe)
   {
      mPipe->Close();
      delete mPipe;
      mPipe = nullptr;
   }
}

SimulationExtension* SimulationExtension::Find(const WsfSimulation& aSimulation)
{
   return static_cast<SimulationExtension*>(aSimulation.FindExtension("event_gateway"));
}

// ============================================================================
// AddedToSimulation - open pipes and connect observers
// ============================================================================

void SimulationExtension::AddedToSimulation()
{
   if (!mConfig.IsEnabled())
   {
      return;
   }

   // Open event pipe
   mPipe = new EventPipeWriter();
   if (!mPipe->Open(mConfig.GetEventPipeName()))
   {
      std::cerr << "wsf_event_gateway: failed to open event pipe, plugin disabled\n";
      delete mPipe;
      mPipe = nullptr;
      return;
   }

   // Open control pipe
   mControl = new ControlPipeReader();
   if (!mControl->Open(mConfig.GetControlPipeName(), this))
   {
      std::cerr << "wsf_event_gateway: control pipe failed (non-fatal, continuing)\n";
      delete mControl;
      mControl = nullptr;
   }

   // --- Simulation lifecycle ---
   mCallbacks += WsfObserver::SimulationStarting(&GetSimulation()).Connect(&SimulationExtension::OnSimulationStarting, this);
   mCallbacks += WsfObserver::SimulationComplete(&GetSimulation()).Connect(&SimulationExtension::OnSimulationComplete, this);
   mCallbacks += WsfObserver::SimulationPausing(&GetSimulation()).Connect(&SimulationExtension::OnSimulationPausing, this);
   mCallbacks += WsfObserver::SimulationResuming(&GetSimulation()).Connect(&SimulationExtension::OnSimulationResuming, this);
   mCallbacks += WsfObserver::FrameComplete(&GetSimulation()).Connect(&SimulationExtension::OnFrameComplete, this);

   // --- Platform ---
   mCallbacks += WsfObserver::PlatformAdded(&GetSimulation()).Connect(&SimulationExtension::OnPlatformAdded, this);
   mCallbacks += WsfObserver::PlatformInitialized(&GetSimulation()).Connect(&SimulationExtension::OnPlatformInitialized, this);
   mCallbacks += WsfObserver::PlatformDeleted(&GetSimulation()).Connect(&SimulationExtension::OnPlatformDeleted, this);
   mCallbacks += WsfObserver::PlatformBroken(&GetSimulation()).Connect(&SimulationExtension::OnPlatformBroken, this);
   mCallbacks += WsfObserver::PlatformDamageChanged(&GetSimulation()).Connect(&SimulationExtension::OnPlatformDamageChanged, this);

   // --- Mover ---
   mCallbacks += WsfObserver::MoverUpdated(&GetSimulation()).Connect(&SimulationExtension::OnMoverUpdated, this);

   // --- Sensor ---
   mCallbacks += WsfObserver::SensorTurnedOn(&GetSimulation()).Connect(&SimulationExtension::OnSensorTurnedOn, this);
   mCallbacks += WsfObserver::SensorTurnedOff(&GetSimulation()).Connect(&SimulationExtension::OnSensorTurnedOff, this);
   mCallbacks += WsfObserver::SensorDetectionChanged(&GetSimulation()).Connect(&SimulationExtension::OnSensorDetectionChanged, this);
   mCallbacks += WsfObserver::SensorTrackInitiated(&GetSimulation()).Connect(&SimulationExtension::OnSensorTrackInitiated, this);
   mCallbacks += WsfObserver::SensorTrackDropped(&GetSimulation()).Connect(&SimulationExtension::OnSensorTrackDropped, this);

   // --- Weapon (wsf_mil) ---
   mCallbacks += WsfObserver::WeaponFired(&GetSimulation()).Connect(&SimulationExtension::OnWeaponFired, this);
   mCallbacks += WsfObserver::WeaponHit(&GetSimulation()).Connect(&SimulationExtension::OnWeaponHit, this);
   mCallbacks += WsfObserver::WeaponMissed(&GetSimulation()).Connect(&SimulationExtension::OnWeaponMissed, this);
   mCallbacks += WsfObserver::WeaponTerminated(&GetSimulation()).Connect(&SimulationExtension::OnWeaponTerminated, this);

   // --- Track ---
   mCallbacks += WsfObserver::LocalTrackInitiated(&GetSimulation()).Connect(&SimulationExtension::OnLocalTrackInitiated, this);
   mCallbacks += WsfObserver::LocalTrackUpdated(&GetSimulation()).Connect(&SimulationExtension::OnLocalTrackUpdated, this);
   mCallbacks += WsfObserver::LocalTrackDropped(&GetSimulation()).Connect(&SimulationExtension::OnLocalTrackDropped, this);

   // --- Comment ---
   mCallbacks += WsfObserver::Comment(&GetSimulation()).Connect(&SimulationExtension::OnComment, this);

   // --- Fuel ---
   mCallbacks += WsfObserver::FuelEvent(&GetSimulation()).Connect(&SimulationExtension::OnFuelEvent, this);

   // --- Task (WsfTaskManager) ---
   mCallbacks += WsfObserver::TaskAssigned(&GetSimulation()).Connect(&SimulationExtension::OnTaskAssigned, this);
   mCallbacks += WsfObserver::TaskCompleted(&GetSimulation()).Connect(&SimulationExtension::OnTaskCompleted, this);
   mCallbacks += WsfObserver::TaskCanceled(&GetSimulation()).Connect(&SimulationExtension::OnTaskCanceled, this);

   // Note: ZoneEntered/ZoneExited are not standard AFSIM observers.
   // Zone proximity events would require a separate zone-crossing detector.
   // This can be added in a future iteration by periodically checking platform
   // positions against zone boundaries.
}

// ============================================================================
// Helper
// ============================================================================

void SimulationExtension::FillPlatformData(afsim::events::PlatformData& aOut, WsfPlatform* aPlatformPtr)
{
   aOut.set_index(aPlatformPtr->GetIndex());
   aOut.set_name(aPlatformPtr->GetName());
   aOut.set_type_id(aPlatformPtr->GetType());
   aOut.set_side(aPlatformPtr->GetSide());
   aOut.set_icon(aPlatformPtr->GetIcon());
   aOut.set_damage_factor(aPlatformPtr->GetDamageFactor());

   double lat, lon, alt;
   aPlatformPtr->GetLocationLLA(lat, lon, alt);
   aOut.set_lat(lat);
   aOut.set_lon(lon);
   aOut.set_alt(alt);

   double velNED[3];
   aPlatformPtr->GetVelocityNED(velNED);
   aOut.set_vel_n(velNED[0]);
   aOut.set_vel_e(velNED[1]);
   aOut.set_vel_d(velNED[2]);

   // Orientation: AFSIM returns WCS orientation; convert heading/pitch/roll
   double heading, pitch, roll;
   aPlatformPtr->GetOrientationNED(heading, pitch, roll);
   aOut.set_heading(static_cast<float>(heading));
   aOut.set_pitch(static_cast<float>(pitch));
   aOut.set_roll(static_cast<float>(roll));
}

// ============================================================================
// Simulation lifecycle observers
// ============================================================================

void SimulationExtension::OnSimulationStarting()
{
   afsim::events::SimEvent evt;
   evt.set_sim_time(0.0);
   evt.mutable_sim_starting();
   mPipe->Write(evt);
}

void SimulationExtension::OnSimulationComplete(double aSimTime)
{
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   evt.mutable_sim_complete()->set_end_time(aSimTime);
   mPipe->Write(evt);
}

void SimulationExtension::OnSimulationPausing()
{
   afsim::events::SimEvent evt;
   evt.set_sim_time(GetSimulation().GetSimTime());
   evt.mutable_sim_pausing();
   mPipe->Write(evt);
}

void SimulationExtension::OnSimulationResuming()
{
   afsim::events::SimEvent evt;
   evt.set_sim_time(GetSimulation().GetSimTime());
   evt.mutable_sim_resuming();
   mPipe->Write(evt);
}

void SimulationExtension::OnFrameComplete(double aSimTime)
{
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   evt.mutable_frame_complete()->set_sim_time(aSimTime);
   mPipe->Write(evt);
}

// ============================================================================
// Platform observers
// ============================================================================

void SimulationExtension::OnPlatformAdded(double aSimTime, WsfPlatform* aPlatformPtr)
{
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   FillPlatformData(*evt.mutable_platform_added()->mutable_platform(), aPlatformPtr);
   mPipe->Write(evt);
}

void SimulationExtension::OnPlatformInitialized(double aSimTime, WsfPlatform* aPlatformPtr)
{
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   FillPlatformData(*evt.mutable_platform_initialized()->mutable_platform(), aPlatformPtr);
   mPipe->Write(evt);
}

void SimulationExtension::OnPlatformDeleted(double aSimTime, WsfPlatform* aPlatformPtr)
{
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   evt.mutable_platform_deleted()->set_index(aPlatformPtr->GetIndex());
   evt.mutable_platform_deleted()->set_name(aPlatformPtr->GetName());
   mPipe->Write(evt);
}

void SimulationExtension::OnPlatformBroken(double aSimTime, WsfPlatform* aPlatformPtr)
{
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   evt.mutable_platform_broken()->set_index(aPlatformPtr->GetIndex());
   evt.mutable_platform_broken()->set_damage(aPlatformPtr->GetDamageFactor());
   mPipe->Write(evt);
}

void SimulationExtension::OnPlatformDamageChanged(double aSimTime, WsfPlatform* aPlatformPtr)
{
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   evt.mutable_platform_damage_changed()->set_index(aPlatformPtr->GetIndex());
   evt.mutable_platform_damage_changed()->set_damage(aPlatformPtr->GetDamageFactor());
   mPipe->Write(evt);
}

// ============================================================================
// Mover observer (with throttle)
// ============================================================================

void SimulationExtension::OnMoverUpdated(double aSimTime, WsfMover* aMoverPtr)
{
   if (!aMoverPtr || !aMoverPtr->GetPlatform())
   {
      return;
   }

   // Throttle: skip if not enough sim time has elapsed for this platform
   size_t pIdx = aMoverPtr->GetPlatform()->GetIndex();
   double throttle = mConfig.GetMoverThrottle();
   if (throttle > 0.0)
   {
      auto it = mLastMoverTime.find(pIdx);
      if (it != mLastMoverTime.end() && (aSimTime - it->second) < throttle)
      {
         return;
      }
      mLastMoverTime[pIdx] = aSimTime;
   }

   WsfPlatform* plat = aMoverPtr->GetPlatform();
   double lat, lon, alt;
   plat->GetLocationLLA(lat, lon, alt);

   double velNED[3];
   plat->GetVelocityNED(velNED);

   double heading, pitch, roll;
   plat->GetOrientationNED(heading, pitch, roll);

   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   auto* mu = evt.mutable_mover_updated();
   mu->set_platform_index(pIdx);
   mu->set_lat(lat);
   mu->set_lon(lon);
   mu->set_alt(alt);
   mu->set_heading(static_cast<float>(heading));
   mu->set_pitch(static_cast<float>(pitch));
   mu->set_roll(static_cast<float>(roll));
   mu->set_vel_n(velNED[0]);
   mu->set_vel_e(velNED[1]);
   mu->set_vel_d(velNED[2]);

   mPipe->Write(evt, true /* aIsMoverUpdate */);
}

// ============================================================================
// Sensor observers
// ============================================================================

void SimulationExtension::OnSensorTurnedOn(double aSimTime, WsfSensor* aSensorPtr)
{
   if (!aSensorPtr) return;
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   auto* s = evt.mutable_sensor_turned_on()->mutable_sensor();
   s->set_platform_index(aSensorPtr->GetPlatform()->GetIndex());
   s->set_sensor_name(aSensorPtr->GetName());
   s->set_sensor_type(aSensorPtr->GetType());
   mPipe->Write(evt);
}

void SimulationExtension::OnSensorTurnedOff(double aSimTime, WsfSensor* aSensorPtr)
{
   if (!aSensorPtr) return;
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   auto* s = evt.mutable_sensor_turned_off()->mutable_sensor();
   s->set_platform_index(aSensorPtr->GetPlatform()->GetIndex());
   s->set_sensor_name(aSensorPtr->GetName());
   s->set_sensor_type(aSensorPtr->GetType());
   mPipe->Write(evt);
}

void SimulationExtension::OnSensorDetectionChanged(double aSimTime, WsfSensor* aSensorPtr,
   size_t aTargetIndex, WsfSensorResult& aResult)
{
   if (!aSensorPtr) return;
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   auto* d = evt.mutable_sensor_detection_changed();
   auto* s = d->mutable_sensor();
   s->set_platform_index(aSensorPtr->GetPlatform()->GetIndex());
   s->set_sensor_name(aSensorPtr->GetName());
   s->set_sensor_type(aSensorPtr->GetType());
   d->set_target_index(aTargetIndex);
   d->set_detected(aResult.Detected());
   mPipe->Write(evt);
}

void SimulationExtension::OnSensorTrackInitiated(double aSimTime, WsfSensor* aSensorPtr,
   const WsfTrack* aTrackPtr)
{
   if (!aSensorPtr || !aTrackPtr) return;
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   auto* ti = evt.mutable_sensor_track_initiated();
   auto* s = ti->mutable_sensor();
   s->set_platform_index(aSensorPtr->GetPlatform()->GetIndex());
   s->set_sensor_name(aSensorPtr->GetName());
   s->set_sensor_type(aSensorPtr->GetType());

   auto* tid = ti->mutable_track_id();
   tid->set_originator_index(static_cast<uint32_t>(aTrackPtr->GetOriginatorIndex()));
   tid->set_track_number(static_cast<uint32_t>(aTrackPtr->GetTrackId().GetLocalTrackNumber()));

   ti->set_target_index(static_cast<uint64_t>(aTrackPtr->GetTargetIndex()));
   mPipe->Write(evt);
}

void SimulationExtension::OnSensorTrackDropped(double aSimTime, WsfSensor* aSensorPtr,
   const WsfTrack* aTrackPtr)
{
   if (!aSensorPtr || !aTrackPtr) return;
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   auto* td = evt.mutable_sensor_track_dropped();
   auto* s = td->mutable_sensor();
   s->set_platform_index(aSensorPtr->GetPlatform()->GetIndex());
   s->set_sensor_name(aSensorPtr->GetName());
   s->set_sensor_type(aSensorPtr->GetType());

   auto* tid = td->mutable_track_id();
   tid->set_originator_index(static_cast<uint32_t>(aTrackPtr->GetOriginatorIndex()));
   tid->set_track_number(static_cast<uint32_t>(aTrackPtr->GetTrackId().GetLocalTrackNumber()));
   mPipe->Write(evt);
}

// ============================================================================
// Weapon observers (wsf_mil)
// ============================================================================

void SimulationExtension::OnWeaponFired(double aSimTime,
   const WsfWeaponEngagement* aEngagementPtr, const WsfTrack* aTargetTrackPtr)
{
   if (!aEngagementPtr) return;
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   auto* wf = evt.mutable_weapon_fired();
   wf->set_firing_platform_index(aEngagementPtr->GetFiringPlatformIndex());
   wf->set_weapon_name(aEngagementPtr->GetWeaponSystemName());
   wf->set_weapon_platform_index(aEngagementPtr->GetWeaponPlatformIndex());
   wf->set_target_platform_index(aEngagementPtr->GetTargetPlatformIndex());

   // Launch position from firing platform if available
   WsfPlatform* firingPlat = GetSimulation().GetPlatformByIndex(aEngagementPtr->GetFiringPlatformIndex());
   if (firingPlat)
   {
      double lat, lon, alt;
      firingPlat->GetLocationLLA(lat, lon, alt);
      wf->set_launch_lat(lat);
      wf->set_launch_lon(lon);
      wf->set_launch_alt(alt);
   }
   mPipe->Write(evt);
}

void SimulationExtension::OnWeaponHit(double aSimTime,
   const WsfWeaponEngagement* aEngagementPtr, WsfPlatform* aTargetPtr)
{
   if (!aEngagementPtr) return;
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   auto* wh = evt.mutable_weapon_hit();
   wh->set_weapon_platform_index(aEngagementPtr->GetWeaponPlatformIndex());
   wh->set_target_platform_index(aEngagementPtr->GetTargetPlatformIndex());

   if (aTargetPtr)
   {
      double lat, lon, alt;
      aTargetPtr->GetLocationLLA(lat, lon, alt);
      wh->set_target_lat(lat);
      wh->set_target_lon(lon);
      wh->set_target_alt(alt);
   }
   mPipe->Write(evt);
}

void SimulationExtension::OnWeaponMissed(double aSimTime,
   const WsfWeaponEngagement* aEngagementPtr, WsfPlatform* aTargetPtr)
{
   if (!aEngagementPtr) return;
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   auto* wm = evt.mutable_weapon_missed();
   wm->set_weapon_platform_index(aEngagementPtr->GetWeaponPlatformIndex());
   wm->set_target_platform_index(aEngagementPtr->GetTargetPlatformIndex());
   mPipe->Write(evt);
}

void SimulationExtension::OnWeaponTerminated(double aSimTime,
   const WsfWeaponEngagement* aEngagementPtr)
{
   if (!aEngagementPtr) return;
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   auto* wt = evt.mutable_weapon_terminated();
   wt->set_weapon_platform_index(aEngagementPtr->GetWeaponPlatformIndex());

   // Weapon position at termination
   WsfPlatform* weaponPlat = GetSimulation().GetPlatformByIndex(aEngagementPtr->GetWeaponPlatformIndex());
   if (weaponPlat)
   {
      double lat, lon, alt;
      weaponPlat->GetLocationLLA(lat, lon, alt);
      wt->set_lat(lat);
      wt->set_lon(lon);
      wt->set_alt(alt);
   }
   mPipe->Write(evt);
}

// ============================================================================
// Track observers
// ============================================================================

void SimulationExtension::OnLocalTrackInitiated(double aSimTime, WsfPlatform* aPlatformPtr,
   const WsfLocalTrack* aTrackPtr, const WsfTrack* aSourcePtr)
{
   if (!aPlatformPtr || !aTrackPtr) return;
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   auto* ti = evt.mutable_track_initiated();
   ti->set_is_local(true);

   auto* td = ti->mutable_track();
   auto* tid = td->mutable_id();
   tid->set_originator_index(static_cast<uint32_t>(aTrackPtr->GetOriginatorIndex()));
   tid->set_track_number(static_cast<uint32_t>(aTrackPtr->GetTrackId().GetLocalTrackNumber()));
   td->set_originator_index(aPlatformPtr->GetIndex());
   td->set_target_index(static_cast<uint64_t>(aTrackPtr->GetTargetIndex()));
   td->set_quality(static_cast<float>(aTrackPtr->GetQuality()));
   mPipe->Write(evt);
}

void SimulationExtension::OnLocalTrackUpdated(double aSimTime, WsfPlatform* aPlatformPtr,
   const WsfLocalTrack* aTrackPtr, const WsfTrack* aSourcePtr)
{
   if (!aPlatformPtr || !aTrackPtr) return;
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   auto* tu = evt.mutable_track_updated();
   tu->set_is_local(true);

   auto* td = tu->mutable_track();
   auto* tid = td->mutable_id();
   tid->set_originator_index(static_cast<uint32_t>(aTrackPtr->GetOriginatorIndex()));
   tid->set_track_number(static_cast<uint32_t>(aTrackPtr->GetTrackId().GetLocalTrackNumber()));
   td->set_originator_index(aPlatformPtr->GetIndex());
   td->set_target_index(static_cast<uint64_t>(aTrackPtr->GetTargetIndex()));
   td->set_quality(static_cast<float>(aTrackPtr->GetQuality()));
   mPipe->Write(evt);
}

void SimulationExtension::OnLocalTrackDropped(double aSimTime, WsfPlatform* aPlatformPtr,
   const WsfLocalTrack* aTrackPtr)
{
   if (!aPlatformPtr || !aTrackPtr) return;
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   auto* td = evt.mutable_track_dropped();
   td->set_is_local(true);

   auto* tid = td->mutable_id();
   tid->set_originator_index(static_cast<uint32_t>(aTrackPtr->GetOriginatorIndex()));
   tid->set_track_number(static_cast<uint32_t>(aTrackPtr->GetTrackId().GetLocalTrackNumber()));
   mPipe->Write(evt);
}

// ============================================================================
// Comment observer
// ============================================================================

void SimulationExtension::OnComment(double aSimTime, WsfPlatform* aPlatformPtr,
   const std::string& aText)
{
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   auto* c = evt.mutable_comment();
   if (aPlatformPtr)
   {
      c->set_platform_index(aPlatformPtr->GetIndex());
   }
   c->set_text(aText);
   mPipe->Write(evt);
}

// ============================================================================
// Fuel observer
// ============================================================================

void SimulationExtension::OnFuelEvent(double aSimTime, WsfFuel* aFuelPtr, WsfStringId aEventNameId)
{
   if (!aFuelPtr) return;
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   auto* fe = evt.mutable_fuel_event();
   fe->set_platform_index(aFuelPtr->GetPlatform()->GetIndex());
   fe->set_fuel_name(aFuelPtr->GetName());
   fe->set_event_name(aEventNameId);
   fe->set_quantity(aFuelPtr->GetQuantityRemaining());
   mPipe->Write(evt);
}

// ============================================================================
// Task observers (WsfTaskManager)
// ============================================================================

void SimulationExtension::FillTaskData(afsim::events::TaskData& aOut, const WsfTask* aTaskPtr)
{
   aOut.set_task_id(aTaskPtr->GetTaskId());
   aOut.set_task_type(aTaskPtr->GetTaskType());
   aOut.set_assigner_index(aTaskPtr->GetAssignerPlatformIndex());
   aOut.set_assigner_name(aTaskPtr->GetAssignerPlatformName());
   aOut.set_assignee_index(aTaskPtr->GetAssigneePlatformIndex());
   aOut.set_assignee_name(aTaskPtr->GetAssigneePlatformName());
   aOut.set_resource_name(aTaskPtr->GetResourceName());
   aOut.set_target_name(aTaskPtr->GetTargetName());
   aOut.set_track_number(static_cast<uint32_t>(aTaskPtr->GetTrackId().GetLocalTrackNumber()));
   aOut.set_assign_time(aTaskPtr->GetAssignTime());
}

void SimulationExtension::OnTaskAssigned(double aSimTime, const WsfTask* aTaskPtr, const WsfTrack* aTrackPtr)
{
   if (!aTaskPtr) return;
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   auto* td = evt.mutable_task_assigned()->mutable_task();
   FillTaskData(*td, aTaskPtr);
   if (aTrackPtr)
   {
      td->set_target_index(static_cast<uint64_t>(aTrackPtr->GetTargetIndex()));
   }
   mPipe->Write(evt);
}

void SimulationExtension::OnTaskCompleted(double aSimTime, const WsfTask* aTaskPtr, WsfStringId aStatus)
{
   if (!aTaskPtr) return;
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   auto* tc = evt.mutable_task_completed();
   FillTaskData(*tc->mutable_task(), aTaskPtr);
   tc->set_status(aStatus);
   mPipe->Write(evt);
}

void SimulationExtension::OnTaskCanceled(double aSimTime, const WsfTask* aTaskPtr)
{
   if (!aTaskPtr) return;
   afsim::events::SimEvent evt;
   evt.set_sim_time(aSimTime);
   FillTaskData(*evt.mutable_task_canceled()->mutable_task(), aTaskPtr);
   mPipe->Write(evt);
}

} // namespace gateway
} // namespace wsf
