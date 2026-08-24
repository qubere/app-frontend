"use client";

import React, { createContext, useContext, useState } from "react";

export const defaultDictionary = {
  nav: {
    askQubere: "Ask Qubere AI",
    action: "Action",
    commandCenter: "Command Center",
    operations: "Command Center",
    shipments: "Shipments & Tracking",
    orders: "Freight Orders",
    carriers: "Carriers & Fleet",
    tenders: "Tenders & Bids",
    quotes: "Rate Quotes",
    invoices: "Invoices & Audits",
    customerBilling: "Customer Billing",
    exceptions: "Action",
    freightDocs: "Documents",
    integrations: "Integrations & APIs",
    systemSettings: "System Settings",
    mainOperations: "Main Operations",
    freightExecution: "Freight Execution",
    accountAdmin: "Account Admin",
    platformAdmin: "Platform Admin",
    qubereConsole: "Qubere Console",
    accountProfile: "Account Profile",
    userManagement: "User Management",
    rolesPermissions: "Roles & Permissions",
    settingsAudit: "Settings & Audit",
    documentEmail: "Inbound Email Routing",
  },
  header: {
    signIn: "Sign In",
    getStarted: "Get Started",
  },
};

interface LanguageContextType {
  t: typeof defaultDictionary;
}

const LanguageContext = createContext<LanguageContextType>({
  t: defaultDictionary,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [t] = useState(defaultDictionary);

  return (
    <LanguageContext.Provider value={{ t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
