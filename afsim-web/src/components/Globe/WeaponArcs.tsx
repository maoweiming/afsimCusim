import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { useWeaponStore } from '../../store/weaponStore';
import { usePlatformStore } from '../../store/platformStore';
import { positionFromDegrees } from '../../utils/cesiumUtils';
import { getSideColor } from '../../utils/sideColors';

interface WeaponArcsProps {
  viewer: Cesium.Viewer;
}

export function WeaponArcs({ viewer }: WeaponArcsProps) {
  const weapons = useWeaponStore((s) => s.weapons);
  const arcEntitiesRef = useRef<Map<number, Cesium.Entity>>(new Map());
  const explosionEntitiesRef = useRef<Cesium.Entity[]>([]);

  useEffect(() => {
    const dataSource = viewer.entities;
    const arcEntities = arcEntitiesRef.current;
    const activeIndices = new Set<number>();

    weapons.forEach((weapon, weaponIndex) => {
      activeIndices.add(weaponIndex);

      const launchPos = positionFromDegrees(
        weapon.launch_lon,
        weapon.launch_lat,
        weapon.launch_alt,
      );

      const weaponLat = weapon.current_lat ?? weapon.launch_lat;
      const weaponLon = weapon.current_lon ?? weapon.launch_lon;
      const weaponAlt = weapon.current_alt ?? weapon.launch_alt;
      const weaponPos = positionFromDegrees(weaponLon, weaponLat, weaponAlt);

      const targetPlatform = usePlatformStore.getState().platforms[weapon.target_platform_index];
      const targetPos = targetPlatform
        ? positionFromDegrees(targetPlatform.lon, targetPlatform.lat, targetPlatform.alt)
        : weaponPos;

      const existing = arcEntities.get(weaponIndex);

      if (existing) {
        if (existing.polyline) {
          existing.polyline.positions = new Cesium.CallbackProperty(() => {
            const w = useWeaponStore.getState().weapons.get(weaponIndex);
            if (!w) return [launchPos, weaponPos];
            const wLat = w.current_lat ?? w.launch_lat;
            const wLon = w.current_lon ?? w.launch_lon;
            const wAlt = w.current_alt ?? w.launch_alt;
            return [launchPos, positionFromDegrees(wLon, wLat, wAlt), targetPos];
          }, false);
        }
      } else {
        const firingPlatform = usePlatformStore.getState().platforms[weapon.firing_platform_index];
        const sideColor = firingPlatform ? getSideColor(firingPlatform.side) : Cesium.Color.YELLOW;

        const entity = dataSource.add({
          id: `weapon-arc-${weaponIndex}`,
          polyline: {
            positions: new Cesium.CallbackProperty(() => {
              const w = useWeaponStore.getState().weapons.get(weaponIndex);
              if (!w) return [launchPos, weaponPos];
              const wLat = w.current_lat ?? w.launch_lat;
              const wLon = w.current_lon ?? w.launch_lon;
              const wAlt = w.current_alt ?? w.launch_alt;
              return [launchPos, positionFromDegrees(wLon, wLat, wAlt), targetPos];
            }, false),
            width: 2,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.3,
              color: sideColor.withAlpha(0.8),
            }),
            clampToGround: false,
          },
        });

        arcEntities.set(weaponIndex, entity);
      }

      if (weapon.hit && !explosionEntitiesRef.current.find((e) => e.id === `explosion-${weaponIndex}`)) {
        const explosionEntity = dataSource.add({
          id: `explosion-${weaponIndex}`,
          position: targetPos,
          ellipse: {
            semiMajorAxis: 5000,
            semiMinorAxis: 5000,
            material: Cesium.Color.ORANGE.withAlpha(0.6),
            height: targetPlatform?.alt ?? 0,
            outline: true,
            outlineColor: Cesium.Color.RED.withAlpha(0.8),
            outlineWidth: 2,
          },
        });

        explosionEntitiesRef.current.push(explosionEntity);

        setTimeout(() => {
          dataSource.remove(explosionEntity);
          explosionEntitiesRef.current = explosionEntitiesRef.current.filter(
            (e) => e !== explosionEntity,
          );
        }, 5000);
      }
    });

    arcEntities.forEach((entity, weaponIndex) => {
      if (!activeIndices.has(weaponIndex)) {
        dataSource.remove(entity);
        arcEntities.delete(weaponIndex);
      }
    });
  }, [weapons, viewer]);

  return null;
}
