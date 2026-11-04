// src/context/OnboardingContext.tsx
// Shared onboarding state — equivalent to the `S` object in proto-app.jsx,
// scoped to the screens that need it (empNum, pin, regPin, notif, terms).
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type OnboardingState = {
  empNum: string;
  pin: string;
  regPin: string;
  verifiedName: string;
  tienda: string;
  plaza: string;
  puesto: string;
  createdAt: string;
  // RH loaded this employee's birth date: the first registration asks for it.
  pideFecha: boolean;
  notif: boolean;
  terms: boolean;
  setEmpNum: (v: string) => void;
  setPin: (v: string) => void;
  setRegPin: (v: string) => void;
  setVerifiedName: (v: string) => void;
  setTienda: (v: string) => void;
  setPlaza: (v: string) => void;
  setPuesto: (v: string) => void;
  setCreatedAt: (v: string) => void;
  setPideFecha: (v: boolean) => void;
  setNotif: (v: boolean) => void;
  setTerms: (v: boolean) => void;
  reset: () => void;
};

const OnboardingContext = createContext<OnboardingState | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [empNum, setEmpNum] = useState('');
  const [pin, setPin] = useState('');
  const [regPin, setRegPin] = useState('');
  const [verifiedName, setVerifiedName] = useState('');
  const [tienda, setTienda] = useState('');
  const [plaza, setPlaza] = useState('');
  const [puesto, setPuesto] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [pideFecha, setPideFecha] = useState(false);
  const [notif, setNotif] = useState(true);
  const [terms, setTerms] = useState(false);

  const reset = useCallback(() => {
    setEmpNum('');
    setPin('');
    setRegPin('');
    setVerifiedName('');
    setTienda('');
    setPlaza('');
    setPuesto('');
    setCreatedAt('');
    setPideFecha(false);
    setNotif(true);
    setTerms(false);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        empNum,
        pin,
        regPin,
        verifiedName,
        tienda,
        plaza,
        puesto,
        createdAt,
        pideFecha,
        notif,
        terms,
        setEmpNum,
        setPin,
        setRegPin,
        setVerifiedName,
        setTienda,
        setPlaza,
        setPuesto,
        setCreatedAt,
        setPideFecha,
        setNotif,
        setTerms,
        reset,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
