import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import QRCode from "react-qr-code";
import {
  Activity,
  Archive,
  ArrowLeftRight,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Edit3,
  Eye,
  FileClock,
  Filter,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PackagePlus,
  Printer,
  QrCode,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Wrench,
  X
} from "lucide-react";
import seedAssets from "./data/assets";
import * as appsScriptService from "./services/googleAppsScriptService";
import "./styles.css";

const ORG_ID = "anes";
const AUTH_USERS = [
  { username: "admin", password: "k0000000", role: "admin", displayName: "Admin", id: "user-admin" },
  { username: "0088", password: "f0000000", role: "staff", displayName: "Staff 0088" },
  { username: "0348", password: "j0000000", role: "staff", displayName: "Staff 0348" }
];
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmt = (value) => value || "-";
const getLastCheckedAt = (asset) => asset.lastCheckedAt || asset.lastCheckDate || "";
const getNextCheckDate = (asset) => asset.nextCheckDate || "";
const getResponsiblePerson = (asset) => asset.responsiblePerson || asset.owner || "";
const getVendorCompany = (asset) => asset.vendorCompany || asset.vendor || "";
const getVendorContact = (asset) => asset.vendorContact || asset.vendorPhone || "";
const getNotes = (asset) => asset.notes || asset.note || "";
const uniq = (items, fallback = []) => [...new Set([...items.filter(Boolean), ...fallback])];
const validDate = (value) => value && !Number.isNaN(new Date(value).getTime());
const getAssetUrl = (asset) => (appsScriptService.PUBLIC_APP_URL ? `${appsScriptService.PUBLIC_APP_URL}/asset/${asset.id}` : `/asset/${asset.id}`);
const withAssetDerivedFields = (asset) => ({
  ...asset,
  imageUrl: asset.imageUrl || "",
  imageFileName: asset.imageFileName || "",
  imageUpdatedAt: asset.imageUpdatedAt || "",
  qrCodeUrl: getAssetUrl(asset)
});
const getAssetIdFromPath = () => {
  const match = window.location.pathname.match(/^\/asset\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : "";
};
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const LOCAL_FALLBACK_MESSAGE = "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e43\u0e0a\u0e49\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e20\u0e32\u0e22\u0e43\u0e19\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07 \u0e23\u0e39\u0e1b\u0e08\u0e30\u0e44\u0e21\u0e48\u0e0b\u0e34\u0e07\u0e01\u0e4c\u0e02\u0e49\u0e32\u0e21\u0e2d\u0e38\u0e1b\u0e01\u0e23\u0e13\u0e4c";
const GOOGLE_SHEETS_ACTIVE_MESSAGE = "ใช้งาน Google Sheets อยู่";
const GOOGLE_SHEETS_REQUIRED_MESSAGE = "ยังไม่ได้เชื่อมต่อ Google Sheets จึงไม่สามารถบันทึกข้อมูลหรือรูปได้";
const isTemporaryImageUrl = (value = "") => /^blob:|^data:image\//.test(String(value));
const stripTemporaryImageFields = (asset, { includeUpload = false } = {}) => {
  const { imagePreviewUrl, imageBase64, ...clean } = asset;
  if (includeUpload && imageBase64) clean.imageBase64 = imageBase64;
  if (isTemporaryImageUrl(clean.imageUrl)) clean.imageUrl = "";
  return clean;
};
const readImageFile = (file) =>
  new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      reject(new Error("รองรับเฉพาะไฟล์ jpg, jpeg, png, webp"));
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      reject(new Error("ไฟล์ใหญ่เกิน 5MB ควรใช้ backend/storage สำหรับรูปขนาดใหญ่"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve({ imagePreviewUrl: reader.result, imageBase64: reader.result, imageFileName: file.name, imageUpdatedAt: new Date().toISOString() });
    reader.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
const getPmDueDate = (asset) => {
  const dates = [asset.maintenanceEnd, asset.calibrationEnd]
    .filter(validDate)
    .map((date) => new Date(date))
    .sort((a, b) => a - b);
  return dates[0] ? dates[0].toISOString().slice(0, 10) : "";
};
const getPmStatus = (asset) => {
  const dueDate = getPmDueDate(asset);
  if (!dueDate) return "missing";
  const remainingDays = daysUntil(dueDate);
  if (remainingDays < 0) return "overdue";
  if (remainingDays <= 30) return "soon";
  return "ok";
};

const departments = uniq(seedAssets.map((asset) => asset.department), ["วิสัญญี"]);
const rooms = uniq(seedAssets.map((asset) => asset.room));
const categories = uniq(seedAssets.map((asset) => asset.category));
const statuses = uniq(seedAssets.map((asset) => asset.status), ["พร้อมใช้", "ชำรุด", "ส่งซ่อม", "รอจำหน่าย"]);

const statusClass = {
  พร้อมใช้: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ใช้งานได้: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ชำรุด: "bg-rose-50 text-rose-700 ring-rose-200",
  ส่งซ่อม: "bg-amber-50 text-amber-800 ring-amber-200",
  รอจำหน่าย: "bg-slate-100 text-slate-700 ring-slate-200"
};

const defaultSettings = {
  organizationId: ORG_ID,
  organizationName: "หน่วยงานวิสัญญี",
  logoUrl: "",
  departments,
  rooms,
  categories,
  statuses,
  users: [
    { id: "user-admin", username: "admin", name: "Admin", role: "admin" },
    { id: "u-staff-0088", username: "0088", name: "Staff 0088", role: "staff" },
    { id: "u-staff-0348", username: "0348", name: "Staff 0348", role: "staff" }
  ]
};

function loadDb() {
  const saved = localStorage.getItem("asset-care-db");
  if (saved) {
    const parsed = JSON.parse(saved);
    const hasAnesSeed = parsed.assets?.some((asset) => asset.organizationId === ORG_ID);
    if (hasAnesSeed) {
      return {
        ...parsed,
        assets: parsed.assets.map((asset) => withAssetDerivedFields({ ...asset, organizationId: ORG_ID })),
        settings: {
          ...defaultSettings,
          ...parsed.settings,
          organizationName: "หน่วยงานวิสัญญี",
          users: defaultSettings.users
        }
      };
    }
  }
  return { assets: seedAssets.map((asset) => withAssetDerivedFields({ ...asset, organizationId: ORG_ID })), history: [], settings: defaultSettings, seedSource: "อุปกรณ์วิสัญญี.docx" };
}

const normalizeSettings = (settings = {}, users = defaultSettings.users) => ({
  ...defaultSettings,
  ...settings,
  organizationId: settings.organizationId || ORG_ID,
  organizationName: settings.organizationName || defaultSettings.organizationName,
  departments: Array.isArray(settings.departments) ? settings.departments : uniq(String(settings.departments || "").split(",").map((item) => item.trim()), defaultSettings.departments),
  rooms: Array.isArray(settings.rooms) ? settings.rooms : uniq(String(settings.rooms || "").split(",").map((item) => item.trim()), defaultSettings.rooms),
  categories: Array.isArray(settings.categories) ? settings.categories : uniq(String(settings.categories || "").split(",").map((item) => item.trim()), defaultSettings.categories),
  statuses: Array.isArray(settings.statuses) ? settings.statuses : uniq(String(settings.statuses || "").split(",").map((item) => item.trim()), defaultSettings.statuses),
  users: users.length ? users.map((user) => ({ ...user, name: user.name || user.displayName })) : defaultSettings.users
});

const normalizeRemoteHistory = (log) => ({
  ...log,
  user: log.userDisplayName || log.user || "",
  department: log.department || "",
  status: log.status || "",
  organizationId: log.organizationId || ORG_ID
});

const normalizeRemoteDb = ({ assets = [], history = [], settings = {}, users = [] }) => ({
  assets: assets.map((asset) => withAssetDerivedFields({ ...asset, organizationId: asset.organizationId || ORG_ID })),
  history: history.map(normalizeRemoteHistory),
  settings: normalizeSettings(settings, users),
  seedSource: "Google Apps Script"
});

function loadCurrentUser() {
  const saved = localStorage.getItem("asset-care-current-user");
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    const matched = AUTH_USERS.find((user) => user.username === parsed.username && user.role === parsed.role);
    return matched ? { username: matched.username, role: matched.role, displayName: matched.displayName, name: matched.displayName } : null;
  } catch {
    return null;
  }
}

function App() {
  const [db, setDb] = useState(loadDb);
  const [activePage, setActivePage] = useState("dashboard");
  const [currentUser, setCurrentUser] = useState(loadCurrentUser);
  const [dataMode, setDataMode] = useState(appsScriptService.isAppsScriptConfigured() ? "loading" : "local");
  const [dataMessage, setDataMessage] = useState(appsScriptService.isAppsScriptConfigured() ? "" : LOCAL_FALLBACK_MESSAGE);
  const [connectionTest, setConnectionTest] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    department: "",
    room: "",
    status: "",
    warranty: "",
    repairGroup: ""
  });
  const [logFilters, setLogFilters] = useState({
    date: "",
    actionType: "",
    user: "",
    asset: "",
    department: "",
    status: ""
  });

  const persist = (next) => {
    const normalized = { ...next, assets: next.assets.map(withAssetDerivedFields) };
    setDb(normalized);
    localStorage.setItem("asset-care-db", JSON.stringify(normalized));
  };

  const markLocalFallback = (message = LOCAL_FALLBACK_MESSAGE) => {
    setDataMode("local");
    setDataMessage(message);
  };

  const assertRemoteReady = () => {
    if (!appsScriptService.isAppsScriptConfigured()) {
      throw new Error(`${GOOGLE_SHEETS_REQUIRED_MESSAGE}: VITE_APPS_SCRIPT_URL ยังไม่มีค่า`);
    }
    if (dataMode !== "remote") {
      throw new Error(`${GOOGLE_SHEETS_REQUIRED_MESSAGE}: ${dataMessage || "Apps Script ยังเชื่อมต่อไม่สำเร็จ"}`);
    }
  };

  const syncRemoteDb = async () => {
    if (!appsScriptService.isAppsScriptConfigured()) {
      markLocalFallback();
      return;
    }
    try {
      const [assets, history, settings, users] = await Promise.all([
        appsScriptService.getAssets(),
        appsScriptService.getHistoryLogs(),
        appsScriptService.getSettings(),
        appsScriptService.getUsers()
      ]);
      const next = normalizeRemoteDb({ assets, history, settings, users });
      persist(next);
      setDataMode("remote");
      setDataMessage("");
    } catch (error) {
      console.error("Google Apps Script sync failed", error);
      markLocalFallback(`${LOCAL_FALLBACK_MESSAGE}: ${error.message}`);
    }
  };

  const testGoogleSheetsConnection = async () => {
    setConnectionTest({ status: "loading", message: "กำลังทดสอบการเชื่อมต่อ Google Sheet..." });
    if (!appsScriptService.isAppsScriptConfigured()) {
      const message = "VITE_APPS_SCRIPT_URL ยังไม่มีค่า";
      markLocalFallback(`${LOCAL_FALLBACK_MESSAGE}: ${message}`);
      setConnectionTest({ status: "error", message });
      return;
    }
    try {
      const assets = await appsScriptService.getAssets();
      setDataMode("remote");
      setDataMessage("");
      setConnectionTest({ status: "success", message: `เชื่อมต่อ Google Sheet สำเร็จ พบ ${assets.length} รายการ` });
      await syncRemoteDb();
    } catch (error) {
      console.error("Google Sheet connection test failed", error);
      markLocalFallback(`${LOCAL_FALLBACK_MESSAGE}: ${error.message}`);
      setConnectionTest({ status: "error", message: error.message });
    }
  };

  useEffect(() => {
    syncRemoteDb();
  }, []);

  const closeModal = () => {
    setModal(null);
    if (getAssetIdFromPath()) {
      window.history.pushState({}, "", "/");
    }
  };

  const openAssetDetailRoute = (assetId) => {
    const asset = db.assets.find((item) => item.id === assetId);
    if (!asset) return;
    setActivePage("assets");
    setModal({ type: "detail", asset });
  };

  useEffect(() => {
    if (!currentUser) return;
    const assetId = getAssetIdFromPath();
    if (assetId) openAssetDetailRoute(assetId);
  }, [currentUser, db.assets]);

  const handleLogin = async ({ username, password }) => {
    let user = null;
    if (appsScriptService.isAppsScriptConfigured()) {
      try {
        user = await appsScriptService.login(username.trim(), password);
        setDataMode("remote");
        setDataMessage("");
        await syncRemoteDb();
      } catch (error) {
        console.error("Google Apps Script login failed", error);
        markLocalFallback(`${LOCAL_FALLBACK_MESSAGE}: ${error.message}`);
      }
    }
    if (!user) {
      user = AUTH_USERS.find((item) => item.username === username.trim() && item.password === password);
    }
    if (!user) {
      throw new Error("ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง");
    }
    const normalizedUser = { id: user.id || user.username, username: user.username, role: user.role, displayName: user.displayName, name: user.displayName };
    localStorage.setItem("asset-care-current-user", JSON.stringify(normalizedUser));
    setCurrentUser(normalizedUser);
    setActivePage("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("asset-care-current-user");
    setCurrentUser(null);
    setModal(null);
    setSidebarOpen(false);
    setActivePage("dashboard");
  };

  const addHistory = (asset, actionType, detail, oldValue = "", newValue = "", extra = {}) => ({
    id: `log-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    organizationId: ORG_ID,
    assetId: asset.id,
    assetCode: asset.assetCode || "",
    assetName: asset.assetName,
    actionType,
    detail,
    oldValue,
    newValue,
    userId: currentUser.id || currentUser.username,
    username: currentUser.username,
    userDisplayName: currentUser.displayName,
    userRole: currentUser.role,
    user: currentUser.displayName,
    timestamp: new Date().toISOString(),
    department: asset.department,
    status: asset.status,
    ...extra
  });

  const writeRemoteHistory = async (items) => {
    if (!appsScriptService.isAppsScriptConfigured() || dataMode !== "remote") return;
    await Promise.all(items.map((item) => appsScriptService.createHistoryLog(item)));
  };

  const confirmRemoteAssetImage = async (assetId, requiredImageUrl) => {
    const remoteAsset = await appsScriptService.getAssetById(assetId);
    if (!remoteAsset) {
      throw new Error("ไม่พบข้อมูลทรัพย์สินหลังบันทึกใน Google Sheet");
    }
    const confirmed = withAssetDerivedFields(remoteAsset);
    if (requiredImageUrl && !confirmed.imageUrl) {
      throw new Error("อัปโหลดรูปสำเร็จไม่ครบถ้วน: Google Sheet ยังไม่มี imageUrl");
    }
    if (confirmed.imageUrl && isTemporaryImageUrl(confirmed.imageUrl)) {
      throw new Error("Google Sheet มี imageUrl แบบชั่วคราว กรุณาอัปโหลดรูปใหม่");
    }
    return confirmed;
  };

  const saveAsset = async (payload, existing) => {
    if (existing && currentUser.role !== "admin") return;
    assertRemoteReady();
    const now = new Date().toISOString();
    const remoteReady = appsScriptService.isAppsScriptConfigured() && dataMode === "remote";
    const hasImageUpload = Boolean(payload.imageBase64);
    if (existing) {
      let updated = stripTemporaryImageFields({ ...existing, ...payload, id: existing.id, organizationId: ORG_ID, updatedAt: now }, { includeUpload: remoteReady });
      if (remoteReady) {
        try {
          await appsScriptService.updateAsset(existing.id, updated);
          updated = await confirmRemoteAssetImage(existing.id, hasImageUpload);
          await syncRemoteDb();
        } catch (error) {
          throw new Error(`บันทึกรูป/ข้อมูลไป Google Apps Script ไม่สำเร็จ: ${error.message}`);
        }
      }
      const nextAssets = db.assets.map((asset) => (asset.id === existing.id ? updated : asset));
      const imageChanged = (existing.imageUrl || "") !== (updated.imageUrl || "");
      const imageDetail = !existing.imageUrl && updated.imageUrl ? "เพิ่มรูปทรัพย์สิน" : existing.imageUrl && !updated.imageUrl ? "ลบรูปทรัพย์สิน" : "เปลี่ยนรูปทรัพย์สิน";
      const historyItems = [
        addHistory(updated, "แก้ไขข้อมูล", "แก้ไขข้อมูลทรัพย์สิน", existing.status, updated.status),
        ...(imageChanged ? [addHistory(updated, "update_image", imageDetail, existing.imageFileName || "", updated.imageFileName || "")] : [])
      ];
      try {
        await writeRemoteHistory(historyItems);
      } catch (error) {
        if (remoteReady) throw error;
        markLocalFallback();
      }
      persist({
        ...db,
        assets: nextAssets,
        history: [...historyItems, ...db.history]
      });
    } else {
      const newId = payload.assetCode || `AC-${Date.now()}`;
      const cleanPayload = stripTemporaryImageFields(payload, { includeUpload: remoteReady });
      let newAsset = {
        ...cleanPayload,
        id: newId,
        organizationId: ORG_ID,
        qrCodeUrl: getAssetUrl({ id: newId }),
        imageUrl: cleanPayload.imageUrl || "",
        imageFileName: payload.imageFileName || "",
        imageUpdatedAt: payload.imageUpdatedAt || "",
        createdAt: now,
        updatedAt: now
      };
      if (remoteReady) {
        try {
          await appsScriptService.createAsset(newAsset);
          newAsset = await confirmRemoteAssetImage(newAsset.id, hasImageUpload);
          await syncRemoteDb();
        } catch (error) {
          throw new Error(`บันทึกรูป/ข้อมูลไป Google Apps Script ไม่สำเร็จ: ${error.message}`);
        }
      }
      const historyItems = [
        addHistory(newAsset, "เพิ่มทรัพย์สิน", "เพิ่มทรัพย์สินใหม่", "", newAsset.assetName),
        ...(newAsset.imageUrl ? [addHistory(newAsset, "update_image", "เพิ่มรูปทรัพย์สิน", "", newAsset.imageFileName || "image")] : [])
      ];
      try {
        await writeRemoteHistory(historyItems);
      } catch (error) {
        if (remoteReady) throw error;
        markLocalFallback();
      }
      persist({
        ...db,
        assets: [newAsset, ...db.assets],
        history: [...historyItems, ...db.history]
      });
    }
    setModal(null);
  };

  const deleteAsset = async (asset) => {
    if (currentUser.role !== "admin") return;
    if (appsScriptService.isAppsScriptConfigured() && dataMode === "remote") {
      try {
        await appsScriptService.deleteAsset(asset.id);
      } catch (error) {
        markLocalFallback("กำลังใช้งานข้อมูลภายในเครื่อง");
      }
    }
    const historyItem = addHistory(asset, "ลบทรัพย์สิน", "ลบออกจากทะเบียนทรัพย์สิน", asset.assetName, "");
    try {
      await writeRemoteHistory([historyItem]);
    } catch (error) {
      markLocalFallback("กำลังใช้งานข้อมูลภายในเครื่อง");
    }
    persist({
      ...db,
      assets: db.assets.filter((item) => item.id !== asset.id),
      history: [historyItem, ...db.history]
    });
  };

  const updateAssetImage = async (asset, imagePayload) => {
    assertRemoteReady();
    const remoteReady = appsScriptService.isAppsScriptConfigured() && dataMode === "remote";
    const hasImageUpload = Boolean(imagePayload.imageBase64);
    let updated = stripTemporaryImageFields({ ...asset, ...imagePayload, updatedAt: new Date().toISOString() }, { includeUpload: remoteReady });
    if (remoteReady) {
      try {
        await appsScriptService.updateAsset(asset.id, updated);
        updated = await confirmRemoteAssetImage(asset.id, hasImageUpload);
        await syncRemoteDb();
      } catch (error) {
        throw new Error(`อัปโหลดรูปไป Google Drive ไม่สำเร็จ: ${error.message}`);
      }
    }
    const imageDetail = !asset.imageUrl && updated.imageUrl ? "เพิ่มรูปทรัพย์สิน" : asset.imageUrl && !updated.imageUrl ? "ลบรูปทรัพย์สิน" : "เปลี่ยนรูปทรัพย์สิน";
    const historyItem = addHistory(updated, "update_image", imageDetail, asset.imageFileName || "", updated.imageFileName || "");
    try {
      await writeRemoteHistory([historyItem]);
    } catch (error) {
      if (remoteReady) throw error;
      markLocalFallback();
    }
    persist({
      ...db,
      assets: db.assets.map((item) => (item.id === asset.id ? updated : item)),
      history: [historyItem, ...db.history]
    });
    setModal(null);
  };

  const runCheck = async (asset, payload) => {
    const status = payload.result === "ส่งซ่อม" ? "ส่งซ่อม" : payload.result === "พบปัญหา" ? "ชำรุด" : "พร้อมใช้";
    let updated = {
      ...asset,
      status,
      lastCheckedAt: payload.checkDate,
      nextCheckDate: payload.nextCheckDate,
      responsiblePerson: asset.responsiblePerson || currentUser.displayName,
      updatedAt: new Date().toISOString()
    };
    if (appsScriptService.isAppsScriptConfigured() && dataMode === "remote") {
      try {
        updated = withAssetDerivedFields(await appsScriptService.updateAsset(asset.id, updated));
      } catch (error) {
        markLocalFallback("กำลังใช้งานข้อมูลภายในเครื่อง");
      }
    }
    const historyItem = addHistory(updated, "ตรวจเช็ก", payload.detail || `ผลการตรวจ: ${payload.result}`, asset.status, status, {
      attachmentImageUrl: payload.attachmentImageUrl || "",
      attachmentFileName: payload.attachmentFileName || ""
    });
    try {
      await writeRemoteHistory([historyItem]);
    } catch (error) {
      markLocalFallback("กำลังใช้งานข้อมูลภายในเครื่อง");
    }
    persist({
      ...db,
      assets: db.assets.map((item) => (item.id === asset.id ? updated : item)),
      history: [historyItem, ...db.history]
    });
    setModal(null);
  };

  const runRepair = async (asset, payload) => {
    let updated = { ...asset, status: "ส่งซ่อม", updatedAt: new Date().toISOString() };
    if (appsScriptService.isAppsScriptConfigured() && dataMode === "remote") {
      try {
        updated = withAssetDerivedFields(await appsScriptService.updateAsset(asset.id, updated));
      } catch (error) {
        markLocalFallback("กำลังใช้งานข้อมูลภายในเครื่อง");
      }
    }
    const historyItem = addHistory(updated, "แจ้งซ่อม", `${payload.problem} | ความเร่งด่วน: ${payload.priority}`, asset.status, "ส่งซ่อม", {
      attachmentImageUrl: payload.attachmentImageUrl || "",
      attachmentFileName: payload.attachmentFileName || ""
    });
    try {
      await writeRemoteHistory([historyItem]);
    } catch (error) {
      markLocalFallback("กำลังใช้งานข้อมูลภายในเครื่อง");
    }
    persist({
      ...db,
      assets: db.assets.map((item) => (item.id === asset.id ? updated : item)),
      history: [historyItem, ...db.history]
    });
    setModal(null);
  };

  const runMove = async (asset, payload) => {
    let updated = {
      ...asset,
      department: payload.newDepartment,
      room: payload.newRoom,
      updatedAt: new Date().toISOString()
    };
    if (appsScriptService.isAppsScriptConfigured() && dataMode === "remote") {
      try {
        updated = withAssetDerivedFields(await appsScriptService.updateAsset(asset.id, updated));
      } catch (error) {
        markLocalFallback("กำลังใช้งานข้อมูลภายในเครื่อง");
      }
    }
    const historyItem = addHistory(updated, "ย้ายตำแหน่ง", payload.reason || "ย้ายตำแหน่งทรัพย์สิน", `${asset.department}/${asset.room}`, `${payload.newDepartment}/${payload.newRoom}`);
    try {
      await writeRemoteHistory([historyItem]);
    } catch (error) {
      markLocalFallback("กำลังใช้งานข้อมูลภายในเครื่อง");
    }
    persist({
      ...db,
      assets: db.assets.map((item) => (item.id === asset.id ? updated : item)),
      history: [historyItem, ...db.history]
    });
    setModal(null);
  };

  const exportAssetsCsv = async (assets) => {
    const columns = ["assetCode", "assetName", "category", "department", "room", "serialNumber", "status", "vendorCompany", "maintenanceEnd", "calibrationEnd"];
    const csv = [
      columns.join(","),
      ...assets.map((asset) => columns.map((column) => `"${String(asset[column] || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `asset-care-${todayISO()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    const historyItem = addHistory({ id: "", assetCode: "", assetName: "", department: "", status: "" }, "Export CSV", `Export CSV จำนวน ${assets.length} รายการ`);
    try {
      await writeRemoteHistory([historyItem]);
    } catch (error) {
      markLocalFallback("กำลังใช้งานข้อมูลภายในเครื่อง");
    }
    persist({ ...db, history: [historyItem, ...db.history] });
  };

  const updateSettings = async (settings) => {
    if (currentUser.role !== "admin") return;
    if (appsScriptService.isAppsScriptConfigured() && dataMode === "remote") {
      try {
        const remoteSettings = await appsScriptService.updateSettings(settings);
        persist({ ...db, settings: normalizeSettings(remoteSettings) });
        setModal(null);
        return;
      } catch (error) {
        markLocalFallback("กำลังใช้งานข้อมูลภายในเครื่อง");
      }
    }
    persist({ ...db, settings: { ...db.settings, ...settings } });
    setModal(null);
  };

  const filteredAssets = useMemo(() => {
    return db.assets.filter((asset) => {
      const q = filters.search.trim().toLowerCase();
      const matchSearch = !q || [asset.assetCode, asset.assetName, asset.serialNumber, asset.category, getVendorCompany(asset), asset.room].join(" ").toLowerCase().includes(q);
      const pmStatus = getPmStatus(asset);
      const warrantySoon = filters.warranty !== "soon" || pmStatus === "soon";
      const warrantyExpired = filters.warranty !== "expired" || pmStatus === "overdue";
      const warrantyMissing = filters.warranty !== "missing" || pmStatus === "missing";
      return (
        matchSearch &&
        (!filters.category || asset.category === filters.category) &&
        (!filters.department || asset.department === filters.department) &&
        (!filters.room || asset.room === filters.room) &&
        (!filters.status || asset.status === filters.status) &&
        (!filters.repairGroup || ["ชำรุด", "ส่งซ่อม"].includes(asset.status)) &&
        warrantySoon &&
        warrantyExpired &&
        warrantyMissing
      );
    });
  }, [db.assets, filters]);

  const pageTitle = {
    dashboard: "Dashboard",
    assets: "Asset Management",
    history: "History / Logs",
    settings: "ตั้งค่า"
  }[activePage];

  if (!currentUser) {
    return <LoginPage orgName={db.settings.organizationName} onLogin={handleLogin} dataMessage={dataMessage} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Sidebar activePage={activePage} setActivePage={setActivePage} currentUser={currentUser} open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="lg:pl-72">
        <TopBar title={pageTitle} orgName={db.settings.organizationName} user={currentUser} onLogout={handleLogout} setSidebarOpen={setSidebarOpen} />
        <main className="px-4 py-5 sm:px-6 lg:px-8">
          <ConnectionStatus
            dataMode={dataMode}
            dataMessage={dataMessage}
            connectionTest={connectionTest}
            onTest={testGoogleSheetsConnection}
          />
          {activePage === "dashboard" && (
            <Dashboard
              assets={db.assets}
              history={db.history}
              openModal={setModal}
              currentUser={currentUser}
              goToAssets={(nextFilters = {}) => {
                setFilters({ search: "", category: "", department: "", room: "", status: "", warranty: "", repairGroup: "", ...nextFilters });
                setActivePage("assets");
              }}
            />
          )}
          {activePage === "assets" && (
            <AssetManagement
              assets={filteredAssets}
              allAssets={db.assets}
              filters={filters}
              setFilters={setFilters}
              currentUser={currentUser}
              openModal={setModal}
              deleteAsset={deleteAsset}
              onExport={exportAssetsCsv}
            />
          )}
          {activePage === "history" && <HistoryPage history={db.history} filters={logFilters} setFilters={setLogFilters} />}
          {activePage === "settings" &&
            (currentUser.role === "admin" ? (
              <SettingsPage settings={db.settings} openModal={setModal} />
            ) : (
              <AccessDenied />
            ))}
        </main>
      </div>
      {modal?.type === "asset" && (!modal.asset || currentUser.role === "admin") && <AssetForm asset={modal.asset} settings={db.settings} onClose={closeModal} onSave={saveAsset} />}
      {modal?.type === "detail" && <AssetDetail asset={modal.asset} history={db.history} openModal={setModal} currentUser={currentUser} onUpdateImage={updateAssetImage} onClose={closeModal} />}
      {modal?.type === "image" && <ImagePreviewModal asset={modal.asset} onClose={closeModal} />}
      {modal?.type === "editImage" && <AssetImageForm asset={modal.asset} onClose={closeModal} onSave={updateAssetImage} />}
      {modal?.type === "historyImage" && <HistoryImageModal log={modal.log} onClose={closeModal} />}
      {modal?.type === "qr" && <QrModal asset={modal.asset} autoPrint={modal.autoPrint} onClose={closeModal} />}
      {modal?.type === "check" && <CheckForm asset={modal.asset} user={currentUser} onClose={closeModal} onSave={runCheck} />}
      {modal?.type === "repair" && <RepairForm asset={modal.asset} onClose={closeModal} onSave={runRepair} />}
      {modal?.type === "move" && <MoveForm asset={modal.asset} settings={db.settings} user={currentUser} onClose={closeModal} onSave={runMove} />}
      {modal?.type === "settings" && <SettingsForm settings={db.settings} onClose={closeModal} onSave={updateSettings} />}
    </div>
  );
}

function daysUntil(date) {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(year, month - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function LoginPage({ orgName, onLogin, dataMessage }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await onLogin(form);
      setError("");
    } catch (error) {
      setError("ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 px-4 py-8">
      <section className="panel w-full max-w-md p-6 shadow-soft">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-teal-600 text-white">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-950">Asset Care</h1>
            <p className="text-sm text-slate-500">{orgName}</p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <Field label="Username">
            <input className="input" value={form.username} autoFocus onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </Field>
          <Field label="Password">
            <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          {dataMessage && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">{dataMessage}</p>}
          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
          <button className="btn-primary w-full" type="submit" disabled={loading}>{loading ? "กำลังเข้าสู่ระบบ" : "เข้าสู่ระบบ"}</button>
        </form>
      </section>
    </div>
  );
}

function Sidebar({ activePage, setActivePage, currentUser, open, setOpen }) {
  const nav = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "assets", label: "Asset Management", icon: Archive },
    { id: "history", label: "History / Logs", icon: History },
    { id: "settings", label: "ตั้งค่า", icon: Settings, adminOnly: true }
  ];
  return (
    <>
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-teal-600 text-white">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-base font-semibold">Asset Care</p>
              <p className="text-xs text-slate-500">ระบบทะเบียนทรัพย์สิน</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1 p-4">
            {nav.map((item) => {
              const Icon = item.icon;
              const disabled = item.adminOnly && currentUser.role !== "admin";
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (!disabled) {
                      setActivePage(item.id);
                      setOpen(false);
                    }
                  }}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium ${
                    activePage === item.id ? "bg-teal-50 text-teal-700" : disabled ? "cursor-not-allowed text-slate-400" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="border-t border-slate-200 p-4 text-sm">
            <p className="font-medium text-slate-800">{currentUser.displayName}</p>
            <p className="text-slate-500">{currentUser.role}</p>
          </div>
        </div>
      </aside>
      {open && <button className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden" onClick={() => setOpen(false)} aria-label="Close sidebar" />}
    </>
  );
}

function TopBar({ title, orgName, user, onLogout, setSidebarOpen }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-950">{title}</h1>
            <p className="truncate text-sm text-slate-500">{orgName}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="min-w-0 max-w-32 text-right sm:max-w-none">
            <p className="truncate text-sm font-medium">{user.displayName}</p>
            <p className="text-xs text-slate-500">{user.role}</p>
          </div>
          <button className="btn-icon" title="ออกจากระบบ" onClick={onLogout}>
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}

function Dashboard({ assets, history, openModal, currentUser, goToAssets }) {
  const stats = [
    ["ทรัพย์สินทั้งหมด", assets.length, Archive, "bg-sky-50 text-sky-700"],
    ["พร้อมใช้", assets.filter((a) => ["พร้อมใช้", "ใช้งานได้"].includes(a.status)).length, CheckCircle2, "bg-emerald-50 text-emerald-700"],
    ["ชำรุด", assets.filter((a) => a.status === "ชำรุด").length, Activity, "bg-rose-50 text-rose-700"],
    ["ส่งซ่อม", assets.filter((a) => a.status === "ส่งซ่อม").length, Wrench, "bg-amber-50 text-amber-800"],
    ["ใกล้ครบกำหนด PM/สอบเทียบ", assets.filter((a) => getPmStatus(a) === "soon").length, CalendarClock, "bg-violet-50 text-violet-700"],
    ["เกินกำหนด PM/สอบเทียบ", assets.filter((a) => getPmStatus(a) === "overdue").length, FileClock, "bg-rose-50 text-rose-700"],
    ["ไม่มีข้อมูลกำหนด PM/สอบเทียบ", assets.filter((a) => getPmStatus(a) === "missing").length, FileClock, "bg-slate-100 text-slate-700"]
  ];
  const dueSoon = [...assets]
    .filter((asset) => ["soon", "overdue"].includes(getPmStatus(asset)))
    .sort((a, b) => new Date(getPmDueDate(a)) - new Date(getPmDueDate(b)))
    .slice(0, 7);
  const repair = assets.filter((a) => ["ชำรุด", "ส่งซ่อม"].includes(a.status));
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-7">
        {stats.map(([label, value, Icon, tone]) => (
          <section key={label} className="panel p-4">
            <div className={`mb-4 grid h-10 w-10 place-items-center rounded-md ${tone}`}>
              <Icon size={20} />
            </div>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </section>
        ))}
      </div>
      <section className="panel p-4">
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => goToAssets()}>
            <Archive size={17} />
            ดูทะเบียนทั้งหมด
          </button>
          <button className="btn-secondary" onClick={() => openModal({ type: "asset" })}>
            <PackagePlus size={17} />
            เพิ่มทรัพย์สิน
          </button>
          <button className="btn-secondary" onClick={() => goToAssets({ warranty: "expired" })}>
            <FileClock size={17} />
            ดูรายการเกินกำหนด
          </button>
          <button className="btn-secondary" onClick={() => goToAssets({ repairGroup: "repair" })}>
            <Wrench size={17} />
            ดูรายการชำรุด/ส่งซ่อม
          </button>
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <TablePanel title="รายการที่ต้องตรวจเช็กเร็วๆ นี้">
          <MiniAssetTable assets={dueSoon} columns={["assetCode", "assetName", "department", "room", "nextCheckDate", "responsiblePerson"]} openModal={openModal} />
        </TablePanel>
        <TablePanel title="รายการที่ชำรุด/ส่งซ่อม">
          <RepairAssetTable assets={repair} openModal={openModal} />
        </TablePanel>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <SummaryBars title="Summary แยกตามประเภททรัพย์สิน" data={countBy(assets, "category")} />
        <SummaryBars title="Summary แยกตามแผนก/ห้อง" data={countBy(assets, "department")} />
      </div>
      <TablePanel title="ประวัติล่าสุด">
        <HistoryTable history={history.slice(0, 8)} compact />
      </TablePanel>
    </div>
  );
}

function TablePanel({ title, children }) {
  return (
    <section className="panel">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function MiniAssetTable({ assets, columns, openModal }) {
  return (
    <div className="overflow-x-auto">
      <table className="table-compact min-w-[760px]">
        <thead>
          <tr>
            <th>รหัส</th>
            <th>ชื่อทรัพย์สิน</th>
            {columns.includes("status") && <th>สถานะ</th>}
            <th>แผนก</th>
            <th>ห้อง</th>
            {columns.includes("nextCheckDate") && <th>ตรวจครั้งถัดไป</th>}
            {columns.includes("responsiblePerson") && <th>ผู้รับผิดชอบ</th>}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.id}>
              <td className="font-medium">{asset.assetCode}</td>
              <td>{asset.assetName}</td>
              {columns.includes("status") && (
                <td>
                  <StatusBadge status={asset.status} />
                </td>
              )}
              <td>{asset.department}</td>
              <td>{asset.room}</td>
              {columns.includes("nextCheckDate") && <td>{getPmDueDate(asset) || getNextCheckDate(asset)}</td>}
              {columns.includes("responsiblePerson") && <td>{getResponsiblePerson(asset)}</td>}
              <td className="text-right">
                <button className="link-btn" onClick={() => openModal({ type: "detail", asset })}>
                  ดูรายละเอียด
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RepairAssetTable({ assets, openModal }) {
  return (
    <div className="px-1 py-1">
      <table className="table-compact table-fixed">
        <colgroup>
          <col className="w-[23%]" />
          <col className="w-[32%]" />
          <col className="w-[12%]" />
          <col className="w-[14%]" />
          <col className="w-[19%]" />
        </colgroup>
        <thead>
          <tr>
            <th>รหัส</th>
            <th>ชื่อทรัพย์สิน</th>
            <th>ห้อง</th>
            <th>สถานะ</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.id}>
              <td className="break-words text-xs font-semibold text-slate-900">{fmt(asset.assetCode)}</td>
              <td className="max-w-0 truncate font-medium" title={asset.assetName}>{asset.assetName}</td>
              <td className="whitespace-nowrap">{asset.room}</td>
              <td><StatusBadge status={asset.status} /></td>
              <td className="text-right">
                <button className="link-btn" onClick={() => openModal({ type: "detail", asset })}>
                  ดูรายละเอียด
                </button>
              </td>
            </tr>
          ))}
          {assets.length === 0 && (
            <tr>
              <td colSpan="5" className="text-center text-slate-500">ไม่มีรายการ</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SummaryBars({ title, data }) {
  const max = Math.max(...data.map((item) => item.count), 1);
  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 size={18} className="text-teal-700" />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{item.label}</span>
              <span className="font-medium">{item.count}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-teal-600" style={{ width: `${(item.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function countBy(items, key) {
  const result = items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(result).map(([label, count]) => ({ label, count }));
}

function AssetManagement({ assets, allAssets, filters, setFilters, currentUser, openModal, deleteAsset, onExport }) {
  const isAdmin = currentUser.role === "admin";
  return (
    <div className="space-y-5">
      <section className="panel p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1.4fr)_repeat(5,minmax(140px,1fr))_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input className="input pl-10" placeholder="ค้นหารหัส ชื่อ Serial Number..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          </div>
          <Select value={filters.category} onChange={(v) => setFilters({ ...filters, category: v })} options={categories} placeholder="ประเภท" />
          <Select value={filters.department} onChange={(v) => setFilters({ ...filters, department: v })} options={departments} placeholder="แผนก" />
          <Select value={filters.room} onChange={(v) => setFilters({ ...filters, room: v })} options={rooms} placeholder="ห้อง" />
          <Select value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} options={statuses} placeholder="สถานะ" />
          <select className="input" value={filters.warranty} onChange={(e) => setFilters({ ...filters, warranty: e.target.value })}>
            <option value="">PM/สอบเทียบ</option>
            <option value="soon">ใกล้ครบกำหนด</option>
            <option value="expired">เกินกำหนด</option>
            <option value="missing">ไม่มีข้อมูลกำหนด</option>
          </select>
          <button className="btn-secondary" onClick={() => setFilters({ search: "", category: "", department: "", room: "", status: "", warranty: "", repairGroup: "" })}>
            <Filter size={17} />
            ล้าง
          </button>
          {isAdmin && (
            <button className="btn-secondary" onClick={() => onExport(assets)}>
              <Download size={17} />
              Export CSV
            </button>
          )}
          <button className="btn-primary" onClick={() => openModal({ type: "asset" })}>
            <PackagePlus size={17} />
            เพิ่มทรัพย์สิน
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
          <span>แสดง {assets.length} จาก {allAssets.length} รายการ</span>
          {isAdmin && (
            <button className="btn-secondary">
              <Printer size={17} />
              Print
            </button>
          )}
        </div>
      </section>
      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="asset-table min-w-[1480px]">
            <thead>
              <tr>
                <th>รูป</th>
                <th>รหัสทรัพย์สิน</th>
                <th>ชื่อทรัพย์สิน</th>
                <th>ประเภท</th>
                <th>บริษัท/ผู้ให้บริการ</th>
                <th>Serial Number</th>
                <th>แผนก</th>
                <th>ห้อง/ตำแหน่ง</th>
                <th>สถานะ</th>
                <th>สิ้นสุดบริการ/สอบเทียบ</th>
                <th>วันตรวจเช็กถัดไป</th>
                <th>ผู้รับผิดชอบ</th>
                <th className="sticky right-0 bg-slate-50">Action</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <AssetImageThumb asset={asset} onClick={() => openModal({ type: asset.imageUrl ? "image" : "editImage", asset })} />
                      {!asset.imageUrl && <button className="link-btn text-xs" onClick={() => openModal({ type: "editImage", asset })}>เพิ่มรูป</button>}
                    </div>
                  </td>
                  <td className="font-semibold text-slate-900">{asset.assetCode}</td>
                  <td>{asset.assetName}</td>
                  <td>{asset.category}</td>
                  <td>{getVendorCompany(asset)}</td>
                  <td>{asset.serialNumber}</td>
                  <td>{asset.department}</td>
                  <td>{asset.room}</td>
                  <td><StatusBadge status={asset.status} /></td>
                  <td>{getPmDueDate(asset)}</td>
                  <td>{getNextCheckDate(asset)}</td>
                  <td>{getResponsiblePerson(asset)}</td>
                  <td className="sticky right-0 bg-white">
                    <AssetActionButtons asset={asset} isAdmin={isAdmin} openModal={openModal} deleteAsset={deleteAsset} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Select({ value, onChange, options, placeholder }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((item) => (
        <option key={item} value={item}>{item}</option>
      ))}
    </select>
  );
}

function IconButton({ title, onClick, icon: Icon, danger }) {
  return (
    <button title={title} aria-label={title} className={`btn-icon ${danger ? "text-rose-700 hover:bg-rose-50" : ""}`} onClick={onClick}>
      <Icon size={16} />
    </button>
  );
}

function AssetActionButtons({ asset, isAdmin, openModal, deleteAsset }) {
  const actionButtons = [
    { title: "ดูรายละเอียด", icon: Eye, onClick: () => openModal({ type: "detail", asset }) },
    ...(isAdmin ? [{ title: "แก้ไข", icon: Edit3, onClick: () => openModal({ type: "asset", asset }) }] : []),
    { title: asset.imageUrl ? "เปลี่ยนรูป" : "เพิ่มรูป", icon: Archive, onClick: () => openModal({ type: "editImage", asset }) },
    { title: "ตรวจเช็ก", icon: ClipboardCheck, onClick: () => openModal({ type: "check", asset }) },
    { title: "แจ้งซ่อม", icon: Wrench, onClick: () => openModal({ type: "repair", asset }) },
    { title: "ย้ายตำแหน่ง", icon: ArrowLeftRight, onClick: () => openModal({ type: "move", asset }) },
    { title: "ดู QR", icon: QrCode, onClick: () => openModal({ type: "qr", asset }) },
    { title: "พิมพ์ QR", icon: Printer, onClick: () => openModal({ type: "qr", asset, autoPrint: true }) },
    ...(isAdmin ? [{ title: "ลบ", icon: Trash2, danger: true, onClick: () => deleteAsset(asset) }] : [])
  ];
  return (
    <div className="asset-actions">
      <div className="asset-actions-desktop">
        {actionButtons.map((button) => (
          <IconButton key={button.title} title={button.title} onClick={button.onClick} icon={button.icon} danger={button.danger} />
        ))}
      </div>
      <div className="asset-actions-mobile">
        {actionButtons.map((button) => (
          <IconButton key={button.title} title={button.title} onClick={button.onClick} icon={button.icon} danger={button.danger} />
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusClass[status] || "bg-slate-100 text-slate-700 ring-slate-200"}`}>{status}</span>;
}

function AssetImageThumb({ asset, size = "sm", onClick }) {
  const sizeClass = size === "lg" ? "h-64 w-full" : "h-12 w-12";
  if (asset.imageUrl) {
    return (
      <button className={`${sizeClass} overflow-hidden rounded-md border border-slate-200 bg-white`} onClick={onClick} type="button">
        <ImageWithFallback src={asset.imageUrl} alt={asset.assetName} className="h-full w-full object-cover" compact={size !== "lg"} />
      </button>
    );
  }
  return (
    <div className={`${sizeClass} grid place-items-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-slate-400`}>
      <Archive size={size === "lg" ? 34 : 18} />
    </div>
  );
}

function ImageWithFallback({ src, alt, className, compact = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  if (!src || failed) {
    return (
      <div className={`grid place-items-center bg-slate-50 text-center font-medium text-rose-700 ${className || ""}`}>
        <span className={compact ? "px-1 text-[10px] leading-tight" : "px-3 text-sm"}>โหลดรูปไม่สำเร็จ</span>
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}

function ModalShell({ title, children, onClose, wide = false, side = false }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 p-0 sm:p-5">
      <section className={`flex max-h-full w-full flex-col bg-white shadow-soft ${side ? "sm:max-w-2xl" : wide ? "sm:m-auto sm:max-w-6xl sm:rounded-lg" : "sm:m-auto sm:max-w-3xl sm:rounded-lg"}`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </section>
    </div>
  );
}

function QrModal({ asset, autoPrint, onClose }) {
  const qrRef = useRef(null);
  const assetUrl = asset.qrCodeUrl || getAssetUrl(asset);

  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  const downloadPng = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgText = serializer.serializeToString(svg);
    const image = new Image();
    const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 900;
      canvas.height = 900;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 50, 50, 800, 800);
      URL.revokeObjectURL(url);
      const link = document.createElement("a");
      link.download = `${asset.assetCode || asset.id}-qr.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    image.src = url;
  };

  return (
    <ModalShell title="QR Code ทรัพย์สิน" onClose={onClose}>
      <div className="grid gap-5 md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div ref={qrRef} className="mx-auto grid aspect-square max-w-56 place-items-center bg-white p-3">
            <QRCode value={assetUrl} size={210} />
          </div>
        </div>
        <div className="space-y-4">
          <DetailSection title="ข้อมูลบนฉลาก" rows={[
            ["ชื่อทรัพย์สิน", asset.assetName],
            ["รหัสทรัพย์สิน", asset.assetCode],
            ["ห้อง/ตำแหน่ง", asset.room],
            ["URL", assetUrl]
          ]} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => window.print()}>
              <Printer size={17} />
              พิมพ์ QR
            </button>
            <button className="btn-secondary" onClick={downloadPng}>
              <Download size={17} />
              ดาวน์โหลด PNG
            </button>
          </div>
          {asset.imageUrl && (
            <div>
              <p className="mb-2 text-sm font-semibold">รูปทรัพย์สิน</p>
              <ImageWithFallback src={asset.imageUrl} alt={asset.assetName} className="h-28 w-28 rounded-md border border-slate-200 object-cover" compact />
            </div>
          )}
        </div>
      </div>
      <div className="print-label">
        <div className="print-label-inner">
          <div className="print-qr">
            <QRCode value={assetUrl} size={132} />
          </div>
          <div className="print-copy">
            {asset.imageUrl && <img src={asset.imageUrl} alt={asset.assetName} className="print-thumb" />}
            <p className="print-system">Asset Care</p>
            <p className="print-name">{asset.assetName}</p>
            <p>รหัส: {fmt(asset.assetCode)}</p>
            <p>ห้อง: {fmt(asset.room)}</p>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function ImagePreviewModal({ asset, onClose }) {
  return (
    <ModalShell title="รูปทรัพย์สิน" onClose={onClose}>
      <div className="space-y-3">
        <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
          <ImageWithFallback src={asset.imageUrl} alt={asset.assetName} className="max-h-[70vh] w-full object-contain" />
        </div>
        <div>
          <p className="font-semibold">{asset.assetName}</p>
          <p className="text-sm text-slate-500">{asset.assetCode || asset.id}</p>
        </div>
      </div>
    </ModalShell>
  );
}

function HistoryImageModal({ log, onClose }) {
  return (
    <ModalShell title="รูปประกอบเหตุการณ์" onClose={onClose}>
      <div className="space-y-3">
        <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
          <ImageWithFallback src={log.attachmentImageUrl} alt={log.attachmentFileName || log.actionType} className="max-h-[70vh] w-full object-contain" />
        </div>
        <div>
          <p className="font-semibold">{log.actionType}</p>
          <p className="text-sm text-slate-500">{log.assetName} · {log.attachmentFileName || "รูปประกอบ"}</p>
        </div>
      </div>
    </ModalShell>
  );
}

function AssetImageForm({ asset, onClose, onSave }) {
  const [form, setForm] = useState({
    imageUrl: asset.imageUrl || "",
    imagePreviewUrl: "",
    imageBase64: "",
    imageFileName: asset.imageFileName || "",
    imageUpdatedAt: asset.imageUpdatedAt || ""
  });
  const [imageError, setImageError] = useState("");

  const handleImageFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const image = await readImageFile(file);
      setImageError("");
      setForm({ ...form, ...image, imageUrl: "" });
    } catch (error) {
      setImageError(error.message);
    } finally {
      event.target.value = "";
    }
  };

  return (
    <ModalShell title="จัดการรูปทรัพย์สิน" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="font-semibold">{asset.assetName}</p>
          <p className="text-sm text-slate-500">{asset.assetCode || asset.id} · {asset.room}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
          <div className="h-28 w-28 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
            {form.imagePreviewUrl || form.imageUrl ? <img src={form.imagePreviewUrl || form.imageUrl} alt="preview" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-slate-500">ยังไม่มีรูป</div>}
          </div>
          <div className="space-y-3">
            <input className="input" value={form.imageUrl} placeholder="URL รูปภาพถาวร หรือเลือกไฟล์" onChange={(e) => setForm({ ...form, imageUrl: e.target.value, imagePreviewUrl: "", imageBase64: "", imageUpdatedAt: new Date().toISOString() })} />
            <div className="flex flex-wrap gap-2">
              <label className="btn-secondary cursor-pointer">
                เลือกรูป
                <input className="hidden" type="file" accept={IMAGE_ACCEPT} onChange={handleImageFile} />
              </label>
              {(form.imagePreviewUrl || form.imageUrl) && <button className="btn-secondary" type="button" onClick={() => setForm({ imageUrl: "", imagePreviewUrl: "", imageBase64: "", imageFileName: "", imageUpdatedAt: new Date().toISOString() })}>ลบรูป</button>}
            </div>
            {form.imageFileName && <p className="text-xs text-slate-500">ไฟล์: {form.imageFileName}</p>}
            {imageError && <p className="text-sm font-medium text-rose-700">{imageError}</p>}
          </div>
        </div>
      </div>
      <ModalActions onClose={onClose} onSave={() => onSave(asset, form)} />
    </ModalShell>
  );
}

function AssetForm({ asset, settings, onClose, onSave }) {
  const [form, setForm] = useState(asset || {
    assetCode: "",
    assetName: "",
    category: settings.categories[0],
    serialNumber: "",
    department: settings.departments[0],
    room: settings.rooms[0],
    status: "พร้อมใช้",
    purchaseDate: todayISO(),
    warrantyEnd: "",
    maintenanceStart: "",
    maintenanceEnd: "",
    calibrationStart: "",
    calibrationEnd: "",
    lastCheckedAt: "",
    nextCheckDate: "",
    responsiblePerson: "",
    vendorCompany: "",
    vendorContact: "",
    notes: "",
    imageUrl: "",
    imagePreviewUrl: "",
    imageBase64: "",
    imageFileName: "",
    imageUpdatedAt: "",
    qrCode: "",
    history: []
  });
  const [imageError, setImageError] = useState("");
  const set = (key, value) => setForm({ ...form, [key]: value });
  const handleImageFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const image = await readImageFile(file);
      setImageError("");
      setForm({ ...form, ...image, imageUrl: "" });
    } catch (error) {
      setImageError(error.message);
    } finally {
      event.target.value = "";
    }
  };
  const removeImage = () => {
    setForm({ ...form, imageUrl: "", imagePreviewUrl: "", imageBase64: "", imageFileName: "", imageUpdatedAt: new Date().toISOString() });
    setImageError("");
  };
  return (
    <ModalShell title={asset ? "แก้ไขทรัพย์สิน" : "เพิ่มทรัพย์สิน"} onClose={onClose} wide>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="รหัสทรัพย์สิน"><input className="input" value={form.assetCode} onChange={(e) => set("assetCode", e.target.value)} /></Field>
        <Field label="ชื่อทรัพย์สิน"><input className="input" value={form.assetName} onChange={(e) => set("assetName", e.target.value)} /></Field>
        <Field label="ประเภท"><Select value={form.category} onChange={(v) => set("category", v)} options={settings.categories} placeholder="ประเภท" /></Field>
        <Field label="บริษัทผู้ขาย/ผู้ให้บริการ"><input className="input" value={form.vendorCompany || ""} onChange={(e) => set("vendorCompany", e.target.value)} /></Field>
        <Field label="เบอร์ติดต่อบริษัท"><input className="input" value={form.vendorContact || ""} onChange={(e) => set("vendorContact", e.target.value)} /></Field>
        <Field label="Serial Number"><input className="input" value={form.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} /></Field>
        <Field label="แผนก"><Select value={form.department} onChange={(v) => set("department", v)} options={settings.departments} placeholder="แผนก" /></Field>
        <Field label="ห้อง/ตำแหน่ง"><Select value={form.room} onChange={(v) => set("room", v)} options={settings.rooms} placeholder="ห้อง" /></Field>
        <Field label="สถานะ"><Select value={form.status} onChange={(v) => set("status", v)} options={settings.statuses} placeholder="สถานะ" /></Field>
        <Field label="วันที่ซื้อ"><input className="input" type="date" value={form.purchaseDate || ""} onChange={(e) => set("purchaseDate", e.target.value)} /></Field>
        <Field label="เริ่ม Maintenance"><input className="input" type="date" value={form.maintenanceStart || ""} onChange={(e) => set("maintenanceStart", e.target.value)} /></Field>
        <Field label="สิ้นสุด Maintenance"><input className="input" type="date" value={form.maintenanceEnd || ""} onChange={(e) => set("maintenanceEnd", e.target.value)} /></Field>
        <Field label="เริ่ม Calibration"><input className="input" type="date" value={form.calibrationStart || ""} onChange={(e) => set("calibrationStart", e.target.value)} /></Field>
        <Field label="สิ้นสุด Calibration"><input className="input" type="date" value={form.calibrationEnd || ""} onChange={(e) => set("calibrationEnd", e.target.value)} /></Field>
        <Field label="วันหมดประกัน"><input className="input" type="date" value={form.warrantyEnd || ""} onChange={(e) => set("warrantyEnd", e.target.value)} /></Field>
        <Field label="วันตรวจเช็กล่าสุด"><input className="input" type="date" value={form.lastCheckedAt || ""} onChange={(e) => set("lastCheckedAt", e.target.value)} /></Field>
        <Field label="วันตรวจเช็กครั้งถัดไป"><input className="input" type="date" value={form.nextCheckDate || ""} onChange={(e) => set("nextCheckDate", e.target.value)} /></Field>
        <Field label="ผู้รับผิดชอบ"><input className="input" value={form.responsiblePerson || ""} onChange={(e) => set("responsiblePerson", e.target.value)} /></Field>
        <Field label="รูปทรัพย์สิน" span>
          <div className="rounded-md border border-slate-200 p-3">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="h-24 w-24 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                {form.imagePreviewUrl || form.imageUrl ? <img src={form.imagePreviewUrl || form.imageUrl} alt="preview" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-slate-500">ยังไม่มีรูป</div>}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <input className="input" value={form.imageUrl || ""} placeholder="URL รูปภาพถาวร หรือเลือกไฟล์ด้านล่าง" onChange={(e) => setForm({ ...form, imageUrl: e.target.value, imagePreviewUrl: "", imageBase64: "", imageUpdatedAt: new Date().toISOString() })} />
                <div className="flex flex-wrap gap-2">
                  <label className="btn-secondary cursor-pointer">
                    เปลี่ยน/อัปโหลดรูป
                    <input className="hidden" type="file" accept={IMAGE_ACCEPT} onChange={handleImageFile} />
                  </label>
                  {(form.imagePreviewUrl || form.imageUrl) && <button className="btn-secondary" type="button" onClick={removeImage}>ลบรูป</button>}
                </div>
                {form.imageFileName && <p className="text-xs text-slate-500">ไฟล์: {form.imageFileName}</p>}
                {imageError && <p className="text-sm font-medium text-rose-700">{imageError}</p>}
              </div>
            </div>
            <p className="text-xs text-slate-500">รองรับ jpg, jpeg, png, webp ขนาดไม่เกิน 5MB ระบบจะอัปโหลดไฟล์ไป Google Drive เมื่อบันทึก</p>
          </div>
        </Field>
        <Field label="หมายเหตุ" span><textarea className="input min-h-24" value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} /></Field>
      </div>
      <ModalActions onClose={onClose} onSave={() => onSave(form, asset)} />
    </ModalShell>
  );
}

function Field({ label, children, span }) {
  return (
    <label className={`block ${span ? "xl:col-span-2" : ""}`}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function ModalActions({ onClose, onSave }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const handleSave = async () => {
    if (saving) return;
    try {
      setSaving(true);
      setError("");
      await onSave();
    } catch (saveError) {
      setError(saveError.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="mt-6 border-t border-slate-200 pt-4">
      {error && <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose} disabled={saving}>ยกเลิก</button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
      </div>
    </div>
  );
}

function AssetDetail({ asset, history, openModal, currentUser, onUpdateImage, onClose }) {
  const isAdmin = currentUser.role === "admin";
  const logs = history.filter((log) => log.assetId === asset.id);
  return (
    <ModalShell title="รายละเอียดทรัพย์สิน" onClose={onClose} side>
      <div className="space-y-5">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">{asset.assetCode}</p>
              <h3 className="text-xl font-semibold">{asset.assetName}</h3>
            </div>
            <StatusBadge status={asset.status} />
          </div>
        </div>
        <DetailSection title="ข้อมูลหลัก" rows={[
          ["ประเภท", asset.category],
          ["บริษัท/ผู้ให้บริการ", getVendorCompany(asset)],
          ["Serial Number", asset.serialNumber],
          ["หมายเหตุ", getNotes(asset)]
        ]} />
        <DetailSection title="ตำแหน่งปัจจุบัน" rows={[["แผนก", asset.department], ["ห้อง/ตำแหน่ง", asset.room], ["ผู้รับผิดชอบ", getResponsiblePerson(asset)]]} />
        <DetailSection title="ข้อมูลประกัน/บริการ" rows={[
          ["วันหมดประกัน", asset.warrantyEnd],
          ["Maintenance", `${fmt(asset.maintenanceStart)} ถึง ${fmt(asset.maintenanceEnd)}`],
          ["Calibration", `${fmt(asset.calibrationStart)} ถึง ${fmt(asset.calibrationEnd)}`],
          ["เบอร์ติดต่อ", getVendorContact(asset)]
        ]} />
        <DetailSection title="สถานะล่าสุด" rows={[["ตรวจล่าสุด", getLastCheckedAt(asset)], ["ตรวจครั้งถัดไป", getNextCheckDate(asset)], ["สถานะ", asset.status]]} />
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold">รูปภาพ</h4>
            <div className="flex flex-wrap gap-2">
              <button className="link-btn" onClick={() => openModal({ type: "editImage", asset })}>{asset.imageUrl ? "เปลี่ยนรูป" : "เพิ่มรูป"}</button>
              {asset.imageUrl && (
                <button
                  className="link-btn text-rose-700"
                  onClick={() => onUpdateImage(asset, { imageUrl: "", imageFileName: "", imageUpdatedAt: new Date().toISOString() })}
                >
                  ลบรูป
                </button>
              )}
            </div>
          </div>
          {asset.imageUrl ? (
            <button className="block w-full overflow-hidden rounded-md border border-slate-200 bg-slate-50" onClick={() => openModal({ type: "image", asset })}>
              <ImageWithFallback src={asset.imageUrl} className="h-64 w-full object-contain" alt={asset.assetName} />
            </button>
          ) : (
            <div className="grid h-44 place-items-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
              ยังไม่มีรูปทรัพย์สิน
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => openModal({ type: "check", asset })}><ClipboardCheck size={17} />ตรวจเช็ก</button>
          <button className="btn-secondary" onClick={() => openModal({ type: "repair", asset })}><Wrench size={17} />แจ้งซ่อม</button>
          <button className="btn-secondary" onClick={() => openModal({ type: "move", asset })}><ArrowLeftRight size={17} />ย้ายตำแหน่ง</button>
          {isAdmin && <button className="btn-secondary" onClick={() => openModal({ type: "asset", asset })}><Edit3 size={17} />แก้ไข</button>}
          <button className="btn-secondary" onClick={() => openModal({ type: "qr", asset })}><QrCode size={17} />ดู QR</button>
          <button className="btn-secondary" onClick={() => openModal({ type: "qr", asset, autoPrint: true })}><Printer size={17} />พิมพ์ QR</button>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Timeline ประวัติ</h4>
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="border-l-2 border-teal-600 pl-3">
                <p className="text-sm font-medium">{log.actionType}</p>
                <p className="text-sm text-slate-600">{log.detail}</p>
                {log.attachmentImageUrl && (
                  <button className="mt-2 block h-24 w-24 overflow-hidden rounded-md border border-slate-200" onClick={() => openModal({ type: "historyImage", log })}>
                    <img src={log.attachmentImageUrl} alt={log.attachmentFileName || "history attachment"} className="h-full w-full object-cover" />
                  </button>
                )}
                <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString("th-TH")} โดย {log.user}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function DetailSection({ title, rows }) {
  return (
    <section>
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      <div className="grid gap-2 rounded-md border border-slate-200 p-3 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <p className="text-slate-500">{label}</p>
            <p className="font-medium">{fmt(value)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CheckForm({ asset, user, onClose, onSave }) {
  const [form, setForm] = useState({ result: "ปกติ", detail: "", checkDate: todayISO(), inspector: user.displayName, nextCheckDate: getNextCheckDate(asset), attachmentImageUrl: "", attachmentFileName: "" });
  const [imageError, setImageError] = useState("");
  const handleAttachment = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const image = await readImageFile(file);
      setImageError("");
      setForm({ ...form, attachmentImageUrl: image.imageUrl, attachmentFileName: image.imageFileName });
    } catch (error) {
      setImageError(error.message);
    } finally {
      event.target.value = "";
    }
  };
  return (
    <ModalShell title="บันทึกการตรวจเช็ก" onClose={onClose}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="ผลการตรวจ"><Select value={form.result} onChange={(v) => setForm({ ...form, result: v })} options={["ปกติ", "พบปัญหา", "ส่งซ่อม"]} placeholder="ผลการตรวจ" /></Field>
        <Field label="วันที่ตรวจ"><input className="input" type="date" value={form.checkDate} readOnly /></Field>
        <Field label="ผู้ตรวจ"><input className="input" value={form.inspector} readOnly /></Field>
        <Field label="วันตรวจครั้งถัดไป"><input className="input" type="date" value={form.nextCheckDate} onChange={(e) => setForm({ ...form, nextCheckDate: e.target.value })} /></Field>
        <Field label="แนบรูปประกอบ">
          <div className="space-y-2">
            {form.attachmentImageUrl && <img src={form.attachmentImageUrl} alt="attachment" className="h-24 w-24 rounded-md border border-slate-200 object-cover" />}
            <label className="btn-secondary cursor-pointer">
              เลือกรูปประกอบ
              <input className="hidden" type="file" accept={IMAGE_ACCEPT} onChange={handleAttachment} />
            </label>
            {form.attachmentImageUrl && <button className="btn-secondary" type="button" onClick={() => setForm({ ...form, attachmentImageUrl: "", attachmentFileName: "" })}>ลบรูปประกอบ</button>}
            {imageError && <p className="text-sm font-medium text-rose-700">{imageError}</p>}
          </div>
        </Field>
        <Field label="รายละเอียดผลตรวจ" span><textarea className="input min-h-28" value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} /></Field>
      </div>
      <ModalActions onClose={onClose} onSave={() => onSave(asset, form)} />
    </ModalShell>
  );
}

function RepairForm({ asset, onClose, onSave }) {
  const [form, setForm] = useState({ problem: "", priority: "ปกติ", vendor: getVendorCompany(asset), repairDate: todayISO(), note: "", attachmentImageUrl: "", attachmentFileName: "" });
  const [imageError, setImageError] = useState("");
  const handleAttachment = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const image = await readImageFile(file);
      setImageError("");
      setForm({ ...form, attachmentImageUrl: image.imageUrl, attachmentFileName: image.imageFileName });
    } catch (error) {
      setImageError(error.message);
    } finally {
      event.target.value = "";
    }
  };
  return (
    <ModalShell title="แจ้งซ่อมทรัพย์สิน" onClose={onClose}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="อาการเสีย" span><textarea className="input min-h-24" value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} /></Field>
        <Field label="ความเร่งด่วน"><Select value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} options={["ต่ำ", "ปกติ", "สูง"]} placeholder="ความเร่งด่วน" /></Field>
        <Field label="บริษัท/ผู้รับซ่อม"><input className="input" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></Field>
        <Field label="วันที่ส่งซ่อม"><input className="input" type="date" value={form.repairDate} onChange={(e) => setForm({ ...form, repairDate: e.target.value })} /></Field>
        <Field label="แนบรูปประกอบ">
          <div className="space-y-2">
            {form.attachmentImageUrl && <img src={form.attachmentImageUrl} alt="attachment" className="h-24 w-24 rounded-md border border-slate-200 object-cover" />}
            <label className="btn-secondary cursor-pointer">
              เลือกรูปประกอบ
              <input className="hidden" type="file" accept={IMAGE_ACCEPT} onChange={handleAttachment} />
            </label>
            {form.attachmentImageUrl && <button className="btn-secondary" type="button" onClick={() => setForm({ ...form, attachmentImageUrl: "", attachmentFileName: "" })}>ลบรูปประกอบ</button>}
            {imageError && <p className="text-sm font-medium text-rose-700">{imageError}</p>}
          </div>
        </Field>
        <Field label="หมายเหตุ" span><textarea className="input min-h-24" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
      </div>
      <ModalActions onClose={onClose} onSave={() => onSave(asset, form)} />
    </ModalShell>
  );
}

function MoveForm({ asset, settings, user, onClose, onSave }) {
  const [form, setForm] = useState({
    oldDepartment: asset.department,
    oldRoom: asset.room,
    newDepartment: asset.department,
    newRoom: asset.room,
    reason: "",
    operator: user.displayName,
    moveDate: todayISO()
  });
  return (
    <ModalShell title="ย้ายตำแหน่งทรัพย์สิน" onClose={onClose}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="แผนกเดิม"><input className="input" value={form.oldDepartment} readOnly /></Field>
        <Field label="ห้องเดิม"><input className="input" value={form.oldRoom} readOnly /></Field>
        <Field label="แผนกใหม่"><Select value={form.newDepartment} onChange={(v) => setForm({ ...form, newDepartment: v })} options={settings.departments} placeholder="แผนกใหม่" /></Field>
        <Field label="ห้องใหม่"><Select value={form.newRoom} onChange={(v) => setForm({ ...form, newRoom: v })} options={settings.rooms} placeholder="ห้องใหม่" /></Field>
        <Field label="ผู้ดำเนินการ"><input className="input" value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} /></Field>
        <Field label="วันที่ย้าย"><input className="input" type="date" value={form.moveDate} onChange={(e) => setForm({ ...form, moveDate: e.target.value })} /></Field>
        <Field label="เหตุผลการย้าย" span><textarea className="input min-h-24" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
      </div>
      <ModalActions onClose={onClose} onSave={() => onSave(asset, form)} />
    </ModalShell>
  );
}

function HistoryPage({ history, filters, setFilters }) {
  const filtered = history.filter((log) => {
    return (
      (!filters.date || log.timestamp.slice(0, 10) === filters.date) &&
      (!filters.actionType || log.actionType === filters.actionType) &&
      (!filters.user || log.user === filters.user) &&
      (!filters.asset || `${log.assetId} ${log.assetName}`.toLowerCase().includes(filters.asset.toLowerCase())) &&
      (!filters.department || log.department === filters.department) &&
      (!filters.status || log.status === filters.status)
    );
  });
  return (
    <div className="space-y-5">
      <section className="panel p-4">
        <div className="grid gap-3 lg:grid-cols-6">
          <input className="input" type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
          <Select value={filters.actionType} onChange={(v) => setFilters({ ...filters, actionType: v })} options={["เพิ่มทรัพย์สิน", "ตรวจเช็ก", "แจ้งซ่อม", "ย้ายตำแหน่ง", "แก้ไขข้อมูล", "เปลี่ยนสถานะ", "update_image", "Login", "Export CSV", "ลบทรัพย์สิน"]} placeholder="ประเภท action" />
          <Select value={filters.user} onChange={(v) => setFilters({ ...filters, user: v })} options={AUTH_USERS.map((user) => user.displayName)} placeholder="ผู้ใช้งาน" />
          <input className="input" placeholder="ทรัพย์สิน" value={filters.asset} onChange={(e) => setFilters({ ...filters, asset: e.target.value })} />
          <Select value={filters.department} onChange={(v) => setFilters({ ...filters, department: v })} options={departments} placeholder="แผนก" />
          <Select value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} options={statuses} placeholder="สถานะ" />
        </div>
      </section>
      <TablePanel title={`ประวัติทั้งหมด (${filtered.length})`}>
        <HistoryTable history={filtered} />
      </TablePanel>
    </div>
  );
}

function HistoryTable({ history, compact }) {
  return (
    <div className="overflow-x-auto">
      <table className="table-compact min-w-[1050px]">
        <thead>
          <tr>
            <th>เวลา</th>
            <th>assetId</th>
            <th>assetName</th>
            <th>actionType</th>
            {!compact && <th>oldValue</th>}
            {!compact && <th>newValue</th>}
            <th>user</th>
            <th>detail</th>
          </tr>
        </thead>
        <tbody>
          {history.map((log) => (
            <tr key={log.id}>
              <td>{new Date(log.timestamp).toLocaleString("th-TH")}</td>
              <td>{log.assetId}</td>
              <td>{log.assetName}</td>
              <td>{log.actionType}</td>
              {!compact && <td>{fmt(log.oldValue)}</td>}
              {!compact && <td>{fmt(log.newValue)}</td>}
              <td>{log.user}</td>
              <td>{log.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SettingsPage({ settings, openModal }) {
  return (
    <div className="space-y-5">
      <section className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-md bg-teal-50 text-teal-700">
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{settings.organizationName}</h2>
            </div>
          </div>
          <button className="btn-primary" onClick={() => openModal({ type: "settings" })}><Settings size={17} />แก้ไขข้อมูลหน่วยงาน</button>
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <SettingList title="รายชื่อแผนก" items={settings.departments} />
        <SettingList title="รายชื่อห้อง" items={settings.rooms} />
        <SettingList title="ประเภททรัพย์สิน" items={settings.categories} />
        <SettingList title="สถานะทรัพย์สิน" items={settings.statuses} />
        <SettingList title="ผู้ใช้งาน" items={settings.users.map((u) => `${u.name} (${u.role})`)} />
        <section className="panel p-5">
          <h3 className="mb-3 font-semibold">โลโก้หน่วยงาน</h3>
          <div className="grid h-36 place-items-center rounded-md border border-dashed border-slate-300 text-sm text-slate-500">{settings.logoUrl || "อัปโหลดโลโก้หน่วยงาน"}</div>
        </section>
      </div>
    </div>
  );
}

function SettingList({ title, items }) {
  return (
    <section className="panel p-5">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => <span key={item} className="rounded-md bg-slate-100 px-3 py-1.5 text-sm">{item}</span>)}
      </div>
    </section>
  );
}

function SettingsForm({ settings, onClose, onSave }) {
  const [form, setForm] = useState({
    organizationName: settings.organizationName,
    logoUrl: settings.logoUrl,
    departments: settings.departments.join("\n"),
    rooms: settings.rooms.join("\n"),
    categories: settings.categories.join("\n"),
    statuses: settings.statuses.join("\n")
  });
  const lines = (value) => value.split("\n").map((item) => item.trim()).filter(Boolean);
  return (
    <ModalShell title="ตั้งค่าข้อมูลพื้นฐาน" onClose={onClose} wide>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="ชื่อหน่วยงาน"><input className="input" value={form.organizationName} onChange={(e) => setForm({ ...form, organizationName: e.target.value })} /></Field>
        <Field label="โลโก้หน่วยงาน"><input className="input" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} /></Field>
        <Field label="รายชื่อแผนก" span><textarea className="input min-h-32" value={form.departments} onChange={(e) => setForm({ ...form, departments: e.target.value })} /></Field>
        <Field label="รายชื่อห้อง" span><textarea className="input min-h-32" value={form.rooms} onChange={(e) => setForm({ ...form, rooms: e.target.value })} /></Field>
        <Field label="ประเภททรัพย์สิน" span><textarea className="input min-h-32" value={form.categories} onChange={(e) => setForm({ ...form, categories: e.target.value })} /></Field>
        <Field label="สถานะทรัพย์สิน" span><textarea className="input min-h-32" value={form.statuses} onChange={(e) => setForm({ ...form, statuses: e.target.value })} /></Field>
      </div>
      <ModalActions
        onClose={onClose}
        onSave={() => onSave({
          organizationName: form.organizationName,
          logoUrl: form.logoUrl,
          departments: lines(form.departments),
          rooms: lines(form.rooms),
          categories: lines(form.categories),
          statuses: lines(form.statuses)
        })}
      />
    </ModalShell>
  );
}

function AccessDenied() {
  return (
    <section className="panel grid min-h-[360px] place-items-center p-8 text-center">
      <div>
        <ShieldCheck className="mx-auto mb-3 text-slate-400" size={42} />
        <h2 className="text-lg font-semibold">ไม่มีสิทธิ์เข้าถึง</h2>
        <p className="mt-1 text-sm text-slate-500">Staff สามารถดูรายการ ตรวจเช็ก แจ้งซ่อม และย้ายตำแหน่งได้ แต่ไม่สามารถจัดการหน้าตั้งค่า</p>
      </div>
    </section>
  );
}

function ConnectionStatus({ dataMode, dataMessage, connectionTest, onTest }) {
  const isRemote = dataMode === "remote";
  const isLoading = dataMode === "loading" || connectionTest?.status === "loading";
  const message = isRemote ? GOOGLE_SHEETS_ACTIVE_MESSAGE : dataMessage || LOCAL_FALLBACK_MESSAGE;
  return (
    <section className={`mb-4 rounded-md border px-4 py-3 ${isRemote ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold">{message}</p>
          {!isRemote && <p className="mt-1 text-sm font-semibold">กำลังใช้ข้อมูลภายในเครื่อง ข้อมูลและรูปจะไม่ซิงก์ข้ามอุปกรณ์</p>}
          {connectionTest?.message && (
            <p className={`mt-1 text-sm ${connectionTest.status === "error" ? "text-rose-700" : "text-slate-700"}`}>
              {connectionTest.message}
            </p>
          )}
        </div>
        <button className={isRemote ? "btn-secondary" : "btn-primary"} type="button" onClick={onTest} disabled={isLoading}>
          {isLoading ? "กำลังทดสอบ..." : "ทดสอบการเชื่อมต่อ Google Sheet"}
        </button>
      </div>
    </section>
  );
}

createRoot(document.getElementById("root")).render(<App />);
