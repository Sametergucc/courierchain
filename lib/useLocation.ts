"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { db } from "./db";

interface LocationState {
  lat: number;
  lng: number;
  source: "gps" | "manual" | "default";
  loading: boolean;
  error: string | null;
}

const ISTANBUL_DEFAULT: [number, number] = [41.0082, 28.9784];

export function useUserLocation() {
  const { user, updateUser } = useAuth();

  const [location, setLocation] = useState<LocationState>({
    lat: user?.lat || ISTANBUL_DEFAULT[0],
    lng: user?.lng || ISTANBUL_DEFAULT[1],
    source: user?.lat ? "manual" : "default",
    loading: true,
    error: null,
  });

  // Konum izni iste
  const requestGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setLocation(prev => ({ ...prev, loading: false, error: "Tarayıcı konum desteklemiyor" }));
      return;
    }

    setLocation(prev => ({ ...prev, loading: true }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation({ lat, lng, source: "gps", loading: false, error: null });

        // Kullanıcı veritabanına kaydet
        if (user) {
          updateUser({ lat, lng });
        }
      },
      (err) => {
        console.warn("Konum hatası:", err.message);
        setLocation(prev => ({
          ...prev,
          loading: false,
          error: err.code === 1 ? "Konum izni reddedildi" : "Konum alınamadı",
          source: prev.source === "gps" ? "default" : prev.source,
        }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [user, updateUser]);

  // Manuel konum seçimi (haritadan tıklama)
  const setManualLocation = useCallback((lat: number, lng: number) => {
    setLocation({ lat, lng, source: "manual", loading: false, error: null });
    if (user) {
      updateUser({ lat, lng });
    }
  }, [user, updateUser]);

  // İlk yüklemede GPS iste
  useEffect(() => {
    // Kullanıcının kayıtlı konumu varsa onu kullan
    if (user?.lat && user?.lng) {
      setLocation({
        lat: user.lat,
        lng: user.lng,
        source: "manual",
        loading: false,
        error: null,
      });
    }
    // Yoksa GPS iste
    requestGPS();
  }, []); // sadece ilk mount'ta

  return {
    location,
    requestGPS,
    setManualLocation,
    coords: [location.lat, location.lng] as [number, number],
  };
}
