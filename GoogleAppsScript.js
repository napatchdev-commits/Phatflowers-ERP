/**
 * Google Apps Script for PhatFlowers ERP Cloud Sync & LINE Bot Integration
 * 
 * วิธีใช้งาน:
 * 1. เปิด Google Sheets ใหม่
 * 2. ไปที่เมนู "ส่วนขยาย" (Extensions) -> "Apps Script"
 * 3. ลบโค้ดเก่าออกให้หมด แล้วคัดลอกโค้ดนี้ไปวางแทน
 * 4. กดปุ่มบันทึกโครงการ (รูปแผ่นดิสก์)
 * 5. กดปุ่ม "การทำให้ใช้งานได้" (Deploy) -> "การทำให้ใช้งานได้ใหม่" (New deployment)
 * 6. เลือกประเภทเป็น "เว็บแอป" (Web app)
 * 7. ตั้งค่า:
 *    - Execute as: "Me" (ตัวคุณ)
 *    - Who has access: "Anyone" (ทุกคน - จำเป็นเพื่อให้เว็บแอปยิงข้อมูลมาได้)
 * 8. กด "Deploy" และอนุญาตสิทธิ์ (Authorize access) ให้เรียบร้อย
 * 9. คัดลอก "URL เว็บแอป" (Web app URL) ที่ได้ ไปใส่ในหน้าตั้งค่าของระบบ PhatFlowers ERP
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJSON({ status: 'error', message: 'No post data received' });
    }
    
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    
    if (action === 'fetch') {
      let db = null;
      try {
        const file = getOrCreateDatabaseFile();
        const content = file.getBlob().getDataAsString();
        db = content && content !== "{}" ? JSON.parse(content) : null;
      } catch (fileErr) {
        Logger.log("Error loading database file: " + fileErr.toString());
      }
      return responseJSON({ status: 'success', result: db });
      
    } else if (action === 'syncAll') {
      const data = requestData.data;
      if (!data) {
        return responseJSON({ status: 'error', message: 'No data provided for sync' });
      }
      
      // 1. บันทึกข้อมูลดิบลงไฟล์ใน Google Drive เพื่อเลี่ยงขีดจำกัดขนาดข้อมูล 9KB ของ Script Properties
      try {
        const file = getOrCreateDatabaseFile();
        file.setContent(JSON.stringify(data));
      } catch (fileErr) {
        Logger.log("Error saving database file: " + fileErr.toString());
        return responseJSON({ status: 'error', message: 'Failed to write DB file: ' + fileErr.toString() });
      }
      
      // 2. นำข้อมูลมาเขียนลง Sheets แยกตามแท็บเพื่อให้คนอ่านและจัดรูปแบบได้ง่าย
      updateSpreadsheetSheets(data);
      
      return responseJSON({ status: 'success' });
      
    } else if (action === 'sendLineMessage') {
      const payload = requestData.data;
      if (!payload || !payload.token || !payload.toId) {
        return responseJSON({ status: 'error', message: 'Missing LINE token or recipient ID' });
      }
      
      let imageUrl = null;
      // ตรวจสอบและประมวลผลรูปภาพ Base64
      if (payload.image && payload.image.indexOf('data:image') === 0) {
        try {
          imageUrl = saveBase64ImageToDrive(payload.image);
        } catch (imgError) {
          Logger.log('Error saving image to Drive: ' + imgError.toString());
        }
      }
      
      const lineStatus = sendLineMessage(payload.token, payload.toId, payload.message, imageUrl);
      if (lineStatus === true) {
        return responseJSON({ status: 'success' });
      } else {
        return responseJSON({ status: 'error', message: lineStatus });
      }
      
    } else if (action === 'createDraftRequest') {
      const requestPayload = requestData.data;
      if (!requestPayload) {
        return responseJSON({ status: 'error', message: 'No request data provided' });
      }
      
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheetResult = addDraftRequestToSheet(ss, requestPayload);
      
      // Send LINE notification to staff if configured
      try {
        const file = getOrCreateDatabaseFile();
        const content = file.getBlob().getDataAsString();
        if (content && content !== "{}") {
          const db = JSON.parse(content);
          const settings = db.settings || {};
          const token = settings.lineChannelAccessToken || settings.lineNotifyToken;
          const toId = settings.lineUserId;
          
          if (token && toId) {
            let msg = `🔔 มีใบแจ้งข้อมูลความสนใจจัดงานใหม่เข้ามา!\n`;
            msg += `👤 ลูกค้า: ${requestPayload.customerName}\n`;
            msg += `📞 เบอร์โทร: ${requestPayload.phone}\n`;
            msg += `📅 วันจัดงาน: ${requestPayload.eventDate}\n`;
            msg += `📍 สถานที่: ${requestPayload.eventLocation}\n`;
            if (requestPayload.notes) {
              msg += `📝 หมายเหตุ: ${requestPayload.notes}\n`;
            }
            msg += `\n📦 รายการที่สนใจ:\n`;
            
            const selectedItems = requestPayload.items || [];
            let hasCustomPrice = false;
            selectedItems.forEach((item) => {
              const priceText = item.unitPrice > 0 ? `${item.unitPrice.toLocaleString('th-TH')} บาท` : `สอบถามราคา`;
              msg += `- ${item.qty}x ${item.description} (${priceText})\n`;
              if (item.unitPrice === 0) hasCustomPrice = true;
            });
            
            if (hasCustomPrice) {
              const startText = requestPayload.totalPrice > 0 ? `เริ่มต้น ${requestPayload.totalPrice.toLocaleString('th-TH')} บาท (มีรายการรอเสนอราคา)` : `รอเสนอราคา`;
              msg += `\n💰 ยอดรวมประมาณการ: ${startText}`;
            } else {
              msg += `\n💰 ยอดรวมประมาณการ: ${requestPayload.totalPrice.toLocaleString('th-TH')} บาท`;
            }
            
            sendLineMessage(token, toId, msg, null);
          }
        }
      } catch (lineErr) {
        Logger.log("Error sending line notification for draft request: " + lineErr.toString());
      }
      
      return responseJSON({ status: 'success', message: 'Inquiry registered successfully', requestId: sheetResult.requestId });
      
    } else if (action === 'debugFetch') {
      const files = DriveApp.getFilesByName("phatflowers_db_backup.json");
      const list = [];
      while (files.hasNext()) {
        const f = files.next();
        list.push({
          id: f.getId(),
          name: f.getName(),
          size: f.getSize(),
          lastUpdated: f.getLastUpdated().toString(),
          content: f.getBlob().getDataAsString()
        });
      }
      return responseJSON({ status: 'success', files: list });
      
    } else {
      return responseJSON({ status: 'error', message: 'Invalid action: ' + action });
    }
    
  } catch (err) {
    return responseJSON({ status: 'error', message: 'Server error: ' + err.toString() });
  }
}

function doGet(e) {
  return ContentService.createTextOutput("PhatFlowers ERP Web App is running. Use POST request to interact.");
}

// ช่วยจัดรูปแบบการส่งกลับข้อมูลเป็น JSON
function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ฟังก์ชันดึงหรือสร้างไฟล์สำรองข้อมูลดิบใน Google Drive
function getOrCreateDatabaseFile() {
  const fileName = "phatflowers_db_backup.json";
  const files = DriveApp.getFilesByName(fileName);
  const list = [];
  while (files.hasNext()) {
    list.push(files.next());
  }
  
  if (list.length === 0) {
    return DriveApp.createFile(fileName, "{}", MimeType.PLAIN_TEXT);
  }
  
  // จัดเรียงไฟล์ตามวันที่แก้ไขล่าสุด (ใหม่สุดอยู่บน)
  list.sort((a, b) => b.getLastUpdated().getTime() - a.getLastUpdated().getTime());
  
  const mainFile = list[0];
  
  // ลบไฟล์ซ้ำที่เก่ากว่าทิ้งเพื่อป้องกันการดึงผิดไฟล์ในอนาคต
  if (list.length > 1) {
    for (let i = 1; i < list.length; i++) {
      try {
        list[i].setTrashed(true);
      } catch (trashErr) {
        Logger.log("Error trashing duplicate file: " + trashErr.toString());
      }
    }
  }
  
  return mainFile;
}

// ฟังก์ชันบันทึกภาพลง Google Drive และทำให้เป็นลิงก์สาธารณะ
function saveBase64ImageToDrive(base64DataStr) {
  // แยกส่วนหัว data:image/png;base64, ออก
  const parts = base64DataStr.split(',');
  const contentType = parts[0].split(':')[1].split(';')[0];
  const base64Data = parts[1];
  
  const decoded = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(decoded, contentType, "ERP_Document_" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd_HHmmss") + ".png");
  
  // ตรวจหาโฟลเดอร์สำหรับเก็บรูปใน Google Drive (ถ้ายังไม่มีให้สร้างใหม่)
  const folderName = "PhatFlowers_ERP_Images";
  let folder;
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(folderName);
  }
  
  const file = folder.createFile(blob);
  
  // ตั้งค่าสิทธิ์ให้ทุกคนที่มีลิงก์สามารถดูรูปภาพได้ (เพื่อส่งให้ LINE)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  // ดึง Direct link สำหรับแสดงภาพ
  const fileId = file.getId();
  return "https://drive.google.com/uc?export=download&id=" + fileId;
}

// ฟังก์ชันส่งข้อความพร้อมรูปภาพเข้าห้องแชท LINE
function sendLineMessage(token, toId, textMessage, imageUrl) {
  const url = 'https://api.line.me/v2/bot/message/push';
  
  const messages = [];
  
  // เพิ่มข้อความตัวหนังสือ
  messages.push({
    type: 'text',
    text: textMessage
  });
  
  // หากมีรูปภาพ ให้เพิ่มข้อความรูปภาพ
  if (imageUrl) {
    messages.push({
      type: 'image',
      originalContentUrl: imageUrl,
      previewImageUrl: imageUrl
    });
  }
  
  const payload = {
    to: toId,
    messages: messages
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + token
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  if (responseCode === 200) {
    return true;
  } else {
    return 'LINE API returned code ' + responseCode + ': ' + responseText;
  }
}

// ฟังก์ชันเขียนข้อมูลลงในชีตแต่ละชีตเพื่อให้แสดงผลสวยงาม
function updateSpreadsheetSheets(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. อัปเดตชีตการตั้งค่า (Settings)
  updateSettingsSheet(ss, data.settings || {});
  
  // 2. อัปเดตชีตข้อมูลลูกค้า (Customers)
  updateCustomersSheet(ss, data.customers || []);
  
  // 3. อัปเดตชีตรายการบริการ (Catalog งานแต่ง และ CatalogOrdination งานบวช)
  updateCatalogSheet(ss, data.catalog || []);
  updateCatalogOrdinationSheet(ss, data.catalog || []);
  
  // 4. อัปเดตชีตเอกสาร (Documents)
  updateDocumentsSheet(ss, data.documents || []);
  
  // 5. อัปเดตชีตแพ็กเกจจัดงาน (Packages งานแต่ง และ PackagesOrdination งานบวช)
  updatePackagesSheet(ss, data.packages || []);
  updatePackagesOrdinationSheet(ss, data.packages || []);
  
  // 6. อัปเดตชีตโปรโมชัน (Promotions งานแต่ง และ PromotionsOrdination งานบวช)
  updatePromotionsSheet(ss, data.promotions || []);
  updatePromotionsOrdinationSheet(ss, data.promotions || []);
}

function updateSettingsSheet(ss, settings) {
  let sheet = ss.getSheetByName("Settings");
  if (!sheet) {
    sheet = ss.insertSheet("Settings");
  }
  sheet.clear();
  
  // ตั้งหัวตารางและเขียนข้อมูลแนวตั้งเพื่อความสวยงาม
  sheet.getRange(1, 1, 1, 2)
       .setValues([["หัวข้อการตั้งค่า", "ข้อมูล"]])
       .setFontWeight("bold")
       .setBackground("#2dd4bf")
       .setFontColor("#ffffff");
       
  const rows = [
    ["ชื่อบริษัท/ร้าน", settings.companyName || ""],
    ["ที่อยู่", settings.address || ""],
    ["เลขผู้เสียภาษี", settings.taxId || ""],
    ["เบอร์โทรศัพท์", settings.phones || ""],
    ["อีเมล", settings.email || ""],
    ["ชื่อธนาคาร", settings.bankName || ""],
    ["เลขที่บัญชี", settings.bankAccountNo || ""],
    ["ชื่อบัญชี", settings.bankAccountName || ""],
    ["เบอร์พร้อมเพย์", settings.promptPayNo || ""],
    ["ผู้จัดการ", settings.managerName || ""],
    ["ตำแหน่ง", settings.managerPosition || ""],
    ["อัปเดตล่าสุดเมื่อ", Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss")]
  ];
  
  sheet.getRange(2, 1, rows.length, 2).setValues(rows);
  sheet.autoResizeColumns(1, 2);
}

function updateCustomersSheet(ss, customers) {
  let sheet = ss.getSheetByName("Customers");
  if (!sheet) {
    sheet = ss.insertSheet("Customers");
  }
  sheet.clear();
  
  const headers = ["ID", "ชื่อลูกค้า", "เลขประจำตัวผู้เสียภาษี", "เบอร์โทรศัพท์", "ที่อยู่จัดส่ง/จัดงาน", "วันจัดงานหลัก", "สถานที่จัดงานหลัก"];
  sheet.getRange(1, 1, 1, headers.length)
       .setValues([headers])
       .setFontWeight("bold")
       .setBackground("#2dd4bf")
       .setFontColor("#ffffff");
  
  if (customers.length > 0) {
    const rows = customers.map(c => [
      c.id || "",
      c.name || "",
      c.taxId || "",
      c.phone || "",
      c.address || "",
      c.defaultEventDate || "",
      c.defaultEventLocation || ""
    ]);
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.autoResizeColumns(1, headers.length);
}

function updateCatalogSheet(ss, catalog) {
  let sheet = ss.getSheetByName("Catalog");
  if (!sheet) {
    sheet = ss.insertSheet("Catalog");
  }
  sheet.clear();
  
  const headers = ["ID", "รายการสินค้า/บริการ", "ราคาต่อหน่วย (บาท)", "ประเภทงาน"];
  sheet.getRange(1, 1, 1, headers.length)
       .setValues([headers])
       .setFontWeight("bold")
       .setBackground("#2dd4bf")
       .setFontColor("#ffffff");
  
  // กรองเฉพาะสินค้างานแต่งงาน
  const weddingCatalog = catalog.filter(item => item && item.eventType !== 'ordination');
  
  if (weddingCatalog.length > 0) {
    const rows = weddingCatalog.map(item => [
      item.id || "",
      item.description || "",
      item.unitPrice || 0,
      "งานแต่งงาน"
    ]);
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    // จัดรูปแบบคอลัมน์ราคาเป็นตัวเลขการเงิน
    sheet.getRange(2, 3, rows.length, 1).setNumberFormat("#,##0.00");
  }
  sheet.autoResizeColumns(1, headers.length);
}

function updateCatalogOrdinationSheet(ss, catalog) {
  let sheet = ss.getSheetByName("CatalogOrdination");
  if (!sheet) {
    sheet = ss.insertSheet("CatalogOrdination");
  }
  sheet.clear();
  
  const headers = ["ID", "รายการสินค้า/บริการ", "ราคาต่อหน่วย (บาท)", "ประเภทงาน"];
  sheet.getRange(1, 1, 1, headers.length)
       .setValues([headers])
       .setFontWeight("bold")
       .setBackground("#cca43b")
       .setFontColor("#ffffff");
  
  // กรองเฉพาะสินค้างานบวช
  const ordinationCatalog = catalog.filter(item => item && item.eventType === 'ordination');
  
  if (ordinationCatalog.length > 0) {
    const rows = ordinationCatalog.map(item => [
      item.id || "",
      item.description || "",
      item.unitPrice || 0,
      "งานบวช"
    ]);
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    // จัดรูปแบบคอลัมน์ราคาเป็นตัวเลขการเงิน
    sheet.getRange(2, 3, rows.length, 1).setNumberFormat("#,##0.00");
  }
  sheet.autoResizeColumns(1, headers.length);
}

function updateDocumentsSheet(ss, documents) {
  let sheet = ss.getSheetByName("Documents");
  if (!sheet) {
    sheet = ss.insertSheet("Documents");
  }
  sheet.clear();
  
  const headers = [
    "ID เอกสาร", "ประเภทเอกสาร", "เลขที่เอกสาร", "วันที่เอกสาร", 
    "ชื่อลูกค้า", "เบอร์โทร", "สถานที่จัดงาน", "วันจัดงาน", 
    "ยอดส่วนลด", "ยอดรวมสุทธิ", "ยอดมัดจำ", "สถานะ", "รายการสินค้าและบริการ", "แก้ไขล่าสุด"
  ];
  
  sheet.getRange(1, 1, 1, headers.length)
       .setValues([headers])
       .setFontWeight("bold")
       .setBackground("#2dd4bf")
       .setFontColor("#ffffff");
  
  if (documents.length > 0) {
    const rows = documents.map(d => {
      // แปลงประเภทเอกสารเป็นภาษาไทย
      const docTypeThai = d.docType === 'quotation' ? 'ใบเสนอราคา' : d.docType === 'receipt' ? 'ใบเสร็จรับเงิน' : 'ใบส่งสินค้า';
      
      // แปลงรายการสินค้าเป็นข้อความให้อ่านง่าย
      const itemsText = (d.items || []).map(item => `${item.qty}x ${item.description} (${item.unitPrice})`).join(', ');
      
      return [
        d.id || "",
        docTypeThai,
        d.docNo || "",
        d.date || "",
        d.customerName || "",
        d.customerPhone || "",
        d.eventLocation || "",
        d.eventDate || "",
        d.discount || 0,
        d.grandTotal || 0,
        d.depositAmount || 0,
        d.status || "",
        itemsText,
        d.updatedAt || ""
      ];
    });
    
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    
    // จัดรูปแบบคอลัมน์เงิน
    sheet.getRange(2, 9, rows.length, 3).setNumberFormat("#,##0.00");
  }
  sheet.autoResizeColumns(1, headers.length);
}

// ฟังก์ชันเพิ่มข้อมูลใบขอเสนอราคาแบบร่างของลูกค้าลงชีต DraftRequests
function addDraftRequestToSheet(ss, payload) {
  let sheet = ss.getSheetByName("DraftRequests");
  if (!sheet) {
    sheet = ss.insertSheet("DraftRequests");
  }
  
  const headers = [
    "ID คำขอ", "วันที่ยื่นคำขอ", "ชื่อลูกค้า", "เบอร์โทรศัพท์", 
    "วันจัดงาน", "สถานที่จัดงาน", "รายการที่เลือก", "ยอดรวมสุทธิ (บาท)", "หมายเหตุ", "สถานะ"
  ];
  
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length)
         .setValues([headers])
         .setFontWeight("bold")
         .setBackground("#fb7185")
         .setFontColor("#ffffff");
  }
  
  const requestId = "REQ-" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd") + "-" + Math.floor(1000 + Math.random() * 9000);
  
  let hasCustomPrice = false;
  const itemsText = (payload.items || []).map(item => {
    if (item.unitPrice === 0) hasCustomPrice = true;
    return `${item.qty}x ${item.description} (${item.unitPrice > 0 ? item.unitPrice + ' บ.' : 'สอบถามราคา'})`;
  }).join(', ');
  
  let finalNotes = payload.notes || "";
  if (hasCustomPrice) {
    finalNotes = finalNotes ? finalNotes + " | (มีรายการรอประเมินราคาเพิ่มเติม)" : "(มีรายการรอประเมินราคาเพิ่มเติม)";
  }
  
  const row = [
    requestId,
    Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss"),
    payload.customerName || "",
    payload.phone || "",
    payload.eventDate || "",
    payload.eventLocation || "",
    itemsText,
    payload.totalPrice || 0,
    finalNotes,
    "สนใจติดต่อกลับ"
  ];
  
  sheet.appendRow(row);
  
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 8).setNumberFormat("#,##0.00");
  sheet.autoResizeColumns(1, headers.length);
  
  return { requestId: requestId };
}

// ฟังก์ชันอัปเดตชีตแพ็กเกจจัดงาน (Packages)
function updatePackagesSheet(ss, packages) {
  let sheet = ss.getSheetByName("Packages");
  if (!sheet) {
    sheet = ss.insertSheet("Packages");
  }
  sheet.clear();
  
  const headers = ["ID", "ชื่อแพ็กเกจ", "ราคา (บาท)", "ป้ายกำกับ", "รายการบริการที่รวม (แยกด้วยเครื่องหมายจุลภาค ,)", "ไฮไลต์เด่น (yes/no)", "ประเภทงาน"];
  sheet.getRange(1, 1, 1, headers.length)
       .setValues([headers])
       .setFontWeight("bold")
       .setBackground("#2dd4bf")
       .setFontColor("#ffffff");
       
  // กรองเฉพาะแพ็กเกจงานแต่ง
  const weddingPkgs = packages.filter(p => p && p.eventType !== 'ordination');
  
  if (weddingPkgs.length > 0) {
    const rows = weddingPkgs.map(pkg => [
      pkg.id || "",
      pkg.name || "",
      pkg.price || 0,
      pkg.badge || "",
      Array.isArray(pkg.items) ? pkg.items.join(', ') : (pkg.items || ""),
      pkg.isHighlighted ? "yes" : "no",
      "งานแต่งงาน"
    ]);
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    sheet.getRange(2, 3, rows.length, 1).setNumberFormat("#,##0.00");
  }
  sheet.autoResizeColumns(1, headers.length);
}

function updatePackagesOrdinationSheet(ss, packages) {
  let sheet = ss.getSheetByName("PackagesOrdination");
  if (!sheet) {
    sheet = ss.insertSheet("PackagesOrdination");
  }
  sheet.clear();
  
  const headers = ["ID", "ชื่อแพ็กเกจ", "ราคา (บาท)", "ป้ายกำกับ", "รายการบริการที่รวม (แยกด้วยเครื่องหมายจุลภาค ,)", "ไฮไลต์เด่น (yes/no)", "ประเภทงาน"];
  sheet.getRange(1, 1, 1, headers.length)
       .setValues([headers])
       .setFontWeight("bold")
       .setBackground("#cca43b")
       .setFontColor("#ffffff");
       
  // กรองเฉพาะแพ็กเกจงานบวช
  const ordinationPkgs = packages.filter(p => p && p.eventType === 'ordination');
  
  if (ordinationPkgs.length > 0) {
    const rows = ordinationPkgs.map(pkg => [
      pkg.id || "",
      pkg.name || "",
      pkg.price || 0,
      pkg.badge || "",
      Array.isArray(pkg.items) ? pkg.items.join(', ') : (pkg.items || ""),
      pkg.isHighlighted ? "yes" : "no",
      "งานบวช"
    ]);
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    sheet.getRange(2, 3, rows.length, 1).setNumberFormat("#,##0.00");
  }
  sheet.autoResizeColumns(1, headers.length);
}

// ฟังก์ชันอัปเดตชีตโปรโมชัน (Promotions)
function updatePromotionsSheet(ss, promotions) {
  let sheet = ss.getSheetByName("Promotions");
  if (!sheet) {
    sheet = ss.insertSheet("Promotions");
  }
  sheet.clear();
  
  const headers = ["ID", "หัวข้อโปรโมชัน", "รายละเอียด", "ป้ายกำกับ", "ธีมสี (primary/secondary)", "ประเภทงาน"];
  sheet.getRange(1, 1, 1, headers.length)
       .setValues([headers])
       .setFontWeight("bold")
       .setBackground("#2dd4bf")
       .setFontColor("#ffffff");
       
  // กรองเฉพาะโปรโมชันงานแต่ง
  const weddingPromos = promotions.filter(p => p && p.eventType !== 'ordination');
  
  if (weddingPromos.length > 0) {
    const rows = weddingPromos.map(p => [
      p.id || "",
      p.title || "",
      p.description || "",
      p.badge || "",
      p.type || "primary",
      "งานแต่งงาน"
    ]);
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.autoResizeColumns(1, headers.length);
}

function updatePromotionsOrdinationSheet(ss, promotions) {
  let sheet = ss.getSheetByName("PromotionsOrdination");
  if (!sheet) {
    sheet = ss.insertSheet("PromotionsOrdination");
  }
  sheet.clear();
  
  const headers = ["ID", "หัวข้อโปรโมชัน", "รายละเอียด", "ป้ายกำกับ", "ธีมสี (primary/secondary)", "ประเภทงาน"];
  sheet.getRange(1, 1, 1, headers.length)
       .setValues([headers])
       .setFontWeight("bold")
       .setBackground("#cca43b")
       .setFontColor("#ffffff");
       
  // กรองเฉพาะโปรโมชันงานบวช
  const ordinationPromos = promotions.filter(p => p && p.eventType === 'ordination');
  
  if (ordinationPromos.length > 0) {
    const rows = ordinationPromos.map(p => [
      p.id || "",
      p.title || "",
      p.description || "",
      p.badge || "",
      p.type || "primary",
      "งานบวช"
    ]);
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.autoResizeColumns(1, headers.length);
}
