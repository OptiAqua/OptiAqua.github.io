/**
 * firebase-init.js
 * OptiAqua Analytics Platform — Firebase Configuration
 * Aqua-Aerobic Systems, Inc.
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a project named "OptiAqua-Analytics"
 * 3. Enable Firestore Database (start in production mode)
 * 4. Add a web app and copy the firebaseConfig below
 * 5. In Firestore, create collections:
 *      sales_kpis, shipping_records, hr_data, it_tickets, marketing_data
 * 6. Set up Firebase Hosting for GitHub Pages or use gh-pages
 *
 * Collections Schema:
 * ------------------
 * sales_kpis:     { bids, won, pending, backlog, period, updatedAt }
 * sales_bids:     { bidNum, customer, productLine, value, status, rep, dueDate }
 * shipping_records: { orderNum, customer, destination, carrier, shipDate, status, weight }
 * hr_data:        { totalEmployees, newHires, turnoverRate, openPositions, avgTenure, trainingHours }
 * it_tickets:     { title, category, priority, status, assignee, created, resolved }
 * it_projects:    { name, owner, priority, status, progress, dueDate }
 * marketing_kpis: { sessions, leads, emailOpenRate, conversionRate, updatedAt }
 * app_health:     { name, url, status, lastChecked }
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, getDoc, doc, query, orderBy, limit }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

// ============================================================
// 🔑 REPLACE WITH YOUR FIREBASE PROJECT CONFIG
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyAEaRXQ5i_riUbF9X38JGeSY7JnqNqqWNA",
  authDomain: "optiaqua-1844b.firebaseapp.com",
  projectId: "optiaqua-1844b",
  storageBucket: "optiaqua-1844b.firebasestorage.app",
  messagingSenderId: "366711378787",
  appId: "1:366711378787:web:1c0181a2dc6345d0cd7956",
  measurementId: "G-ZBTH0F423Z"
};

let app, db, analytics;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  analytics = getAnalytics(app);
  console.info('[OptiAqua] Firebase initialized successfully.');
} catch (err) {
  console.warn('[OptiAqua] Firebase init failed — running in demo mode.', err.message);
}

export { db, collection, getDocs, getDoc, doc, query, orderBy, limit };

