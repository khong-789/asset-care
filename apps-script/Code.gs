const SPREADSHEET_ID = "PUT_YOUR_SPREADSHEET_ID_HERE";
const DRIVE_FOLDER_ID = "";
const ORGANIZATION_ID = "anes";

const SHEETS = {
  assets: {
    name: "assets",
    columns: [
      "id",
      "organizationId",
      "assetCode",
      "assetName",
      "category",
      "department",
      "room",
      "serialNumber",
      "status",
      "vendorCompany",
      "vendorContact",
      "maintenanceStart",
      "maintenanceEnd",
      "calibrationStart",
      "calibrationEnd",
      "purchaseDate",
      "warrantyEnd",
      "responsiblePerson",
      "notes",
      "imageUrl",
      "imageFileName",
      "imageUpdatedAt",
      "createdAt",
      "updatedAt"
    ]
  },
  history_logs: {
    name: "history_logs",
    columns: [
      "id",
      "organizationId",
      "assetId",
      "assetCode",
      "assetName",
      "actionType",
      "detail",
      "oldValue",
      "newValue",
      "userId",
      "userDisplayName",
      "userRole",
      "timestamp",
      "attachmentImageUrl"
    ]
  },
  users: {
    name: "users",
    columns: ["id", "username", "password", "role", "displayName", "active", "createdAt"]
  },
  settings: {
    name: "settings",
    columns: ["organizationId", "organizationName", "departments", "rooms", "categories", "statuses", "logoUrl", "updatedAt"]
  }
};

function doGet(e) {
  return safeJsonResponse_(function () {
    const action = String((e.parameter && e.parameter.action) || "");
    const id = String((e.parameter && e.parameter.id) || "");
    switch (action) {
      case "getAssets":
        return ok_(readSheet_("assets"));
      case "getAssetById":
        return ok_(findById_("assets", id));
      case "getHistoryLogs":
        return ok_(readSheet_("history_logs"));
      case "getUsers":
        return ok_(readSheet_("users").map(stripPassword_));
      case "getSettings":
        return ok_(readSettings_());
      default:
        return fail_("Unknown GET action: " + action);
    }
  });
}

function doPost(e) {
  return safeJsonResponse_(function () {
    const payload = parsePayload_(e);
    const action = String(payload.action || "");
    switch (action) {
      case "login":
        return ok_(login_(payload.username, payload.password));
      case "createAsset":
        return ok_(createAsset_(payload.asset || payload));
      case "updateAsset":
        return ok_(updateAsset_(payload.id, payload.updates || payload.asset || payload));
      case "deleteAsset":
        return ok_(deleteAsset_(payload.id));
      case "createHistoryLog":
        return ok_(createHistoryLog_(payload.log || payload));
      case "updateSettings":
        return ok_(updateSettings_(payload.settings || payload));
      case "seedInitialData":
        return ok_(seedInitialData());
      default:
        return fail_("Unknown POST action: " + action);
    }
  });
}

function setupSheets() {
  const ss = getSpreadsheet_();
  Object.keys(SHEETS).forEach(function (key) {
    const config = SHEETS[key];
    const sheet = ss.getSheetByName(config.name) || ss.insertSheet(config.name);
    ensureHeaders_(sheet, config.columns);
  });
  return { success: true, data: "Sheets are ready" };
}

function seedInitialData() {
  setupSheets();
  const now = new Date().toISOString();
  const users = [
    { id: "user-admin", username: "admin", password: "k0000000", role: "admin", displayName: "Admin", active: true, createdAt: now },
    { id: "user-0088", username: "0088", password: "f0000000", role: "staff", displayName: "Staff 0088", active: true, createdAt: now },
    { id: "user-0348", username: "0348", password: "j0000000", role: "staff", displayName: "Staff 0348", active: true, createdAt: now }
  ];
  users.forEach(function (user) {
    upsertById_("users", user.id, user);
  });
  upsertSettings_({
    organizationId: ORGANIZATION_ID,
    organizationName: "หน่วยงานวิสัญญี",
    departments: "วิสัญญี",
    rooms: "RR, OR1, OR2, OR3, OR4, OR5, OR6",
    categories: "",
    statuses: "พร้อมใช้, ชำรุด, ส่งซ่อม, รอจำหน่าย",
    logoUrl: "",
    updatedAt: now
  });
  return { users: users.map(stripPassword_), settings: readSettings_() };
}

function login_(username, password) {
  const user = readSheet_("users").find(function (item) {
    return String(item.username) === String(username) && String(item.password) === String(password) && String(item.active) !== "false";
  });
  if (!user) {
    throw new Error("ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง");
  }
  createHistoryLog_({
    assetId: "",
    assetCode: "",
    assetName: "",
    actionType: "Login",
    detail: "เข้าสู่ระบบ",
    userId: user.id,
    username: user.username,
    userDisplayName: user.displayName,
    userRole: user.role
  });
  return stripPassword_(user);
}

function createAsset_(asset) {
  const now = new Date().toISOString();
  const next = normalizeAsset_({
    id: asset.id || Utilities.getUuid(),
    organizationId: asset.organizationId || ORGANIZATION_ID,
    createdAt: asset.createdAt || now,
    updatedAt: now
  }, asset);
  return appendRow_("assets", next);
}

function updateAsset_(id, updates) {
  if (!id) throw new Error("Missing asset id");
  const asset = findById_("assets", id);
  if (!asset) throw new Error("Asset not found");
  const next = normalizeAsset_(asset, updates, { updatedAt: new Date().toISOString() });
  upsertById_("assets", id, next);
  return next;
}

function deleteAsset_(id) {
  if (!id) throw new Error("Missing asset id");
  const sheet = getSheet_("assets");
  const rows = readSheet_("assets");
  const index = rows.findIndex(function (row) {
    return String(row.id) === String(id);
  });
  if (index === -1) throw new Error("Asset not found");
  sheet.deleteRow(index + 2);
  return { id: id };
}

function createHistoryLog_(log) {
  const now = new Date().toISOString();
  const next = {
    id: log.id || "log-" + Utilities.getUuid(),
    organizationId: log.organizationId || ORGANIZATION_ID,
    assetId: log.assetId || "",
    assetCode: log.assetCode || "",
    assetName: log.assetName || "",
    actionType: log.actionType || log.action || "",
    detail: log.detail || "",
    oldValue: log.oldValue || "",
    newValue: log.newValue || "",
    userId: log.userId || log.username || "",
    userDisplayName: log.userDisplayName || log.user || "",
    userRole: log.userRole || log.role || "",
    timestamp: log.timestamp || now,
    attachmentImageUrl: maybeSaveImage_(log.attachmentImageUrl || "", log.attachmentFileName || "")
  };
  return appendRow_("history_logs", next);
}

function updateSettings_(settings) {
  const next = {
    organizationId: settings.organizationId || ORGANIZATION_ID,
    organizationName: settings.organizationName || "หน่วยงานวิสัญญี",
    departments: toCsv_(settings.departments),
    rooms: toCsv_(settings.rooms),
    categories: toCsv_(settings.categories),
    statuses: toCsv_(settings.statuses),
    logoUrl: settings.logoUrl || "",
    updatedAt: new Date().toISOString()
  };
  upsertSettings_(next);
  return readSettings_();
}

function normalizeAsset_() {
  const merged = {};
  for (let i = 0; i < arguments.length; i++) {
    const source = arguments[i] || {};
    Object.keys(source).forEach(function (key) {
      merged[key] = source[key];
    });
  }
  if (merged.imageBase64) {
    merged.imageUrl = saveImageToDrive_(merged.imageBase64, merged.imageFileName || merged.assetName || "asset-image");
    merged.imageBase64 = "";
  }
  if (merged.imageUrl && isTemporaryImageUrl_(merged.imageUrl)) {
    throw new Error("imageUrl must be a permanent URL. Upload imageBase64 instead.");
  }
  if (merged.imageUrl && !merged.imageUpdatedAt) {
    merged.imageUpdatedAt = new Date().toISOString();
  }
  const clean = {};
  SHEETS.assets.columns.forEach(function (column) {
    clean[column] = merged[column] == null ? "" : merged[column];
  });
  clean.organizationId = clean.organizationId || ORGANIZATION_ID;
  return clean;
}

function maybeSaveImage_(value, fileName) {
  if (!value || typeof value !== "string") return "";
  if (isTemporaryImageUrl_(value) && value.indexOf("data:image/") !== 0) {
    throw new Error("Temporary blob URL cannot be saved");
  }
  if (!value.indexOf || value.indexOf("data:image/") !== 0) return value;
  return saveImageToDrive_(value, fileName);
}

function isTemporaryImageUrl_(value) {
  return typeof value === "string" && (value.indexOf("data:image/") === 0 || value.indexOf("blob:") === 0);
}

function saveImageToDrive_(dataUrl, fileName) {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/);
  if (!match) throw new Error("Invalid image upload payload");
  const mimeType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  const extension = mimeType.split("/")[1].replace("jpeg", "jpg");
  const bytes = Utilities.base64Decode(match[2]);
  const safeName = String(fileName || "asset-image").replace(/[\\/:*?"<>|]/g, "-");
  const blob = Utilities.newBlob(bytes, mimeType, safeName.indexOf(".") > -1 ? safeName : safeName + "." + extension);
  const folder = getImageFolder_();
  const file = folder.createFile(blob);
  if (!file || !file.getId()) throw new Error("Google Drive image upload failed");
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1200";
}

function readSettings_() {
  const rows = readSheet_("settings");
  const first = rows[0] || {};
  return {
    organizationId: first.organizationId || ORGANIZATION_ID,
    organizationName: first.organizationName || "หน่วยงานวิสัญญี",
    departments: fromCsv_(first.departments),
    rooms: fromCsv_(first.rooms),
    categories: fromCsv_(first.categories),
    statuses: fromCsv_(first.statuses || "พร้อมใช้, ชำรุด, ส่งซ่อม, รอจำหน่าย"),
    logoUrl: first.logoUrl || "",
    updatedAt: first.updatedAt || ""
  };
}

function upsertSettings_(settings) {
  const sheet = getSheet_("settings");
  const rows = readSheet_("settings");
  if (rows.length === 0) {
    appendRow_("settings", settings);
  } else {
    writeObjectToRow_(sheet, SHEETS.settings.columns, 2, settings);
  }
}

function readSheet_(key) {
  const sheet = getSheet_(key);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  return values.slice(1).filter(function (row) {
    return row.some(function (value) {
      return value !== "";
    });
  }).map(function (row) {
    const item = {};
    headers.forEach(function (header, index) {
      item[header] = row[index] == null ? "" : row[index];
    });
    return item;
  });
}

function appendRow_(key, item) {
  const sheet = getSheet_(key);
  const columns = SHEETS[key].columns;
  sheet.appendRow(columns.map(function (column) {
    return item[column] == null ? "" : item[column];
  }));
  return item;
}

function upsertById_(key, id, item) {
  const sheet = getSheet_(key);
  const rows = readSheet_(key);
  const index = rows.findIndex(function (row) {
    return String(row.id) === String(id);
  });
  if (index === -1) {
    appendRow_(key, item);
  } else {
    writeObjectToRow_(sheet, SHEETS[key].columns, index + 2, item);
  }
  return item;
}

function findById_(key, id) {
  return readSheet_(key).find(function (row) {
    return String(row.id) === String(id);
  }) || null;
}

function writeObjectToRow_(sheet, columns, rowIndex, item) {
  sheet.getRange(rowIndex, 1, 1, columns.length).setValues([columns.map(function (column) {
    return item[column] == null ? "" : item[column];
  })]);
}

function getSheet_(key) {
  setupSheets();
  return getSpreadsheet_().getSheetByName(SHEETS[key].name);
}

function getSpreadsheet_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === "PUT_YOUR_SPREADSHEET_ID_HERE") {
    throw new Error("Please set SPREADSHEET_ID in Code.gs");
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function ensureHeaders_(sheet, columns) {
  const existing = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), columns.length)).getValues()[0] : [];
  const needsHeader = columns.some(function (column, index) {
    return existing[index] !== column;
  });
  if (needsHeader) {
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    sheet.setFrozenRows(1);
  }
}

function getImageFolder_() {
  if (DRIVE_FOLDER_ID) return DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const name = "asset_register_uploads";
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error("Invalid JSON payload");
  }
}

function ok_(data) {
  return { success: true, data: data };
}

function fail_(message) {
  return { success: false, error: message };
}

function safeJsonResponse_(fn) {
  try {
    return jsonResponse_(fn());
  } catch (error) {
    return jsonResponse_(fail_(error && error.message ? error.message : String(error)));
  }
}

function jsonResponse_(result) {
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function stripPassword_(user) {
  const clean = {};
  Object.keys(user).forEach(function (key) {
    if (key !== "password") clean[key] = user[key];
  });
  return clean;
}

function toCsv_(value) {
  return Array.isArray(value) ? value.join(", ") : String(value || "");
}

function fromCsv_(value) {
  return String(value || "").split(",").map(function (item) {
    return item.trim();
  }).filter(Boolean);
}
