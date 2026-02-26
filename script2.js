// DOM Elements
const cookieInput = document.getElementById("cookie-input");
const loadFileBtn = document.getElementById("load-file-btn");
const pasteBtn = document.getElementById("paste-btn");
const clearBtn = document.getElementById("clear-btn");
const generateBtn = document.getElementById("generate-btn");
const progress = document.getElementById("progress");
const status = document.getElementById("status");
const results = document.getElementById("results");
const copyResultsBtn = document.getElementById("copy-results-btn");
const modeOptions = document.querySelectorAll(".mode-option");
const tabs = document.querySelectorAll(".tab");
const tabContents = document.querySelectorAll(".tab-content");
const batchFiles = document.getElementById("batch-files");
const fileList = document.getElementById("file-list");
const processBatchBtn = document.getElementById("process-batch-btn");
const batchProgress = document.getElementById("batch-progress");
const batchStatus = document.getElementById("batch-status");
const batchResults = document.getElementById("batch-results");
const saveResultsBtn = document.getElementById("save-results-btn");
const totalFiles = document.getElementById("total-files");
const validFiles = document.getElementById("valid-files");
const invalidFiles = document.getElementById("invalid-files");
const notification = document.getElementById("notification");

// Telegram Elements
const telegramToggle = document.getElementById("telegram-toggle");
const telegramConfig = document.getElementById("telegram-config");
const botTokenInput = document.getElementById("bot-token");
const chatIdInput = document.getElementById("chat-id");
const testTelegramBtn = document.getElementById("test-telegram-btn");
const telegramStatus = document.getElementById("telegram-status");

// Global variables
let currentMode = "fullinfo";
let selectedFiles = [];
let batchResultsData = [];

// Event Listeners
document.addEventListener("DOMContentLoaded", initApp);
loadFileBtn.addEventListener("click", handleLoadFile);
pasteBtn.addEventListener("click", handlePaste);
clearBtn.addEventListener("click", handleClear);
generateBtn.addEventListener("click", handleGenerate);
copyResultsBtn.addEventListener("click", handleCopyResults);
modeOptions.forEach((option) => {
  option.addEventListener("click", handleModeChange);
});
tabs.forEach((tab) => {
  tab.addEventListener("click", handleTabChange);
});
batchFiles.addEventListener("change", handleBatchFilesChange);
processBatchBtn.addEventListener("click", handleProcessBatch);
saveResultsBtn.addEventListener("click", handleSaveResults);
function initTabs() {
  tabContents.forEach((content, index) => {
    if (index === 0) {
      content.classList.add("active");
      content.style.display = "block";
    } else {
      content.classList.remove("active");
      content.style.display = "none";
    }
  });
}

// Initialize the application
function initApp() {
  updateFileList();
  initTelegram();
  initTabs();
}

// Handle mode change (Full Info / Token Only)
function handleModeChange(e) {
  const mode = e.target.dataset.mode;
  currentMode = mode;

  modeOptions.forEach((option) => {
    option.classList.remove("active");
  });

  e.target.classList.add("active");
}

// Handle tab change
function handleTabChange(e) {
  const tabId = e.target.dataset.tab;

  // Remove active from all tabs
  tabs.forEach((tab) => {
    tab.classList.remove("active");
  });

  // Hide all tab contents first
  tabContents.forEach((content) => {
    content.classList.remove("active");
    content.style.display = "none"; // Force hide
  });

  // Activate clicked tab
  e.target.classList.add("active");

  // Show selected tab content with delay for animation
  const selectedContent = document.getElementById(`${tabId}-tab`);
  if (selectedContent) {
    selectedContent.style.display = "block";
    // Small delay to allow display:block to apply before adding active class
    setTimeout(() => {
      selectedContent.classList.add("active");
    }, 10);
  }
}

// Handle load file
function handleLoadFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".txt,.json,.zip";

  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      cookieInput.value = e.target.result;
      showNotification("File loaded successfully");
    };
    reader.readAsText(file);
  };

  input.click();
}

// Handle paste from clipboard
function handlePaste() {
  navigator.clipboard
    .readText()
    .then((text) => {
      cookieInput.value = text;
      showNotification("Content pasted from clipboard");
    })
    .catch((err) => {
      showNotification("Failed to read clipboard", true);
    });
}

// Handle clear input
function handleClear() {
  cookieInput.value = "";
  showNotification("Input cleared");
}

// Handle generate token
async function handleGenerate() {
  const content = cookieInput.value.trim();
  if (!content) {
    showNotification("Please enter some content first", true);
    return;
  }

  // Disable button and show progress
  generateBtn.disabled = true;
  generateBtn.innerHTML = '<div class="spinner"></div> Processing...';
  progress.style.width = "0%";
  status.textContent = "Extracting NetflixId...";

  try {
    const response = await fetch("/api/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: content,
        mode: currentMode,
      }),
    });

    const data = await response.json();

    if (data.status === "success") {
      progress.style.width = "100%";
      status.textContent = "Processing complete";
      displayResults(data);
      showNotification("Token generated successfully");
    } else {
      progress.style.width = "100%";
      status.textContent = "Processing failed";
      displayError(data.message);
      showNotification(data.message, true);
    }
  } catch (error) {
    progress.style.width = "100%";
    status.textContent = "Processing failed";
    displayError("Network error: " + error.message);
    showNotification("Network error: " + error.message, true);
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<i class="fas fa-bolt"></i> Generate Token';
  }
}

// Handle copy results
function handleCopyResults() {
  const resultsText = results.innerText;
  navigator.clipboard
    .writeText(resultsText)
    .then(() => {
      showNotification("Results copied to clipboard");
    })
    .catch((err) => {
      showNotification("Failed to copy results", true);
    });
}

// Handle batch files change
function handleBatchFilesChange(e) {
  selectedFiles = Array.from(e.target.files);
  updateFileList();
}

// Update file list display
function updateFileList() {
  fileList.innerHTML = "";

  if (selectedFiles.length === 0) {
    fileList.innerHTML =
      '<div class="file-item"><span>No files selected</span></div>';
    return;
  }

  selectedFiles.forEach((file, index) => {
    const fileItem = document.createElement("div");
    fileItem.className = "file-item";
    fileItem.innerHTML = `
            <span>${file.name}</span>
            <span class="file-status">Pending</span>
        `;
    fileList.appendChild(fileItem);
  });

  totalFiles.textContent = selectedFiles.length;
  validFiles.textContent = "0";
  invalidFiles.textContent = "0";
}

// Update file list to show processing status
function updateFileListProcessing() {
  fileList.innerHTML = "";

  selectedFiles.forEach((file, index) => {
    const fileItem = document.createElement("div");
    fileItem.className = "file-item";
    fileItem.innerHTML = `
            <span>${file.name}</span>
            <span class="file-status processing">Processing...</span>
        `;
    fileList.appendChild(fileItem);
  });
}

// Handle process batch
async function handleProcessBatch() {
  if (selectedFiles.length === 0) {
    showNotification("Please select files first", true);
    return;
  }

  // Reset results
  batchResultsData = [];
  batchResults.innerHTML = "";
  saveResultsBtn.disabled = true;

  // Disable button and show progress
  processBatchBtn.disabled = true;
  processBatchBtn.innerHTML = '<div class="spinner"></div> Processing...';
  batchProgress.style.width = "0%";
  batchStatus.textContent = "Processing batch...";

  const formData = new FormData();
  selectedFiles.forEach((file) => {
    formData.append("files", file);
  });
  formData.append("mode", currentMode);

  try {
    // Update file list status to processing
    updateFileListProcessing();
    const response = await fetch("/api/batch-check", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (data.status === "success") {
      batchResultsData = data.results;
      displayBatchResults(batchResultsData);
      batchProgress.style.width = "100%";
      batchStatus.textContent = "Batch processing complete";
      saveResultsBtn.disabled = false;
      showNotification(
        `Batch processing completed: ${batchResultsData.filter((r) => r.status === "success").length} valid, ${batchResultsData.filter((r) => r.status === "error").length} invalid`,
      );
    } else {
      batchProgress.style.width = "100%";
      batchStatus.textContent = "Batch processing failed";
      showNotification(data.message, true);
    }
  } catch (error) {
    batchProgress.style.width = "100%";
    batchStatus.textContent = "Batch processing failed";
    showNotification("Network error: " + error.message, true);
  } finally {
    processBatchBtn.disabled = false;
    processBatchBtn.innerHTML = '<i class="fas fa-play"></i> Start Processing';
  }
}

// Display batch results
function displayBatchResults(results) {
  batchResults.innerHTML = "";

  let validCount = 0;
  let invalidCount = 0;

  results.forEach((result) => {
    const fileItem = document.createElement("div");
    fileItem.className = "file-item";

    if (result.status === "success") {
      const account = result.account_info;
      const token = result.token_result;

      let statusText = `✅ ${result.filename} | `;
      statusText += `Status: ${account.ok ? "Valid" : "Invalid"} | `;
      statusText += `Premium: ${account.premium ? "Yes" : "No"} | `;
      statusText += `Country: ${account.country}`;

      if (token.status === "Success") {
        statusText += ` | Token: ${token.token.substring(0, 15)}...`;
      }

      fileItem.innerHTML = `
                <div class="file-info">
                    <span>${statusText}</span>
                </div>
                <span class="file-status valid">Valid</span>
            `;
      validCount++;
    } else {
      fileItem.innerHTML = `
                <div class="file-info">
                    <span>❌ ${result.filename}: ${result.message}</span>
                </div>
                <span class="file-status invalid">Invalid</span>
            `;
      invalidCount++;
    }

    batchResults.appendChild(fileItem);
  });

  validFiles.textContent = validCount;
  invalidFiles.textContent = invalidCount;

  // Update success rate
  const successRate = ((validCount / results.length) * 100).toFixed(2);
  batchStatus.textContent = `Complete - Success Rate: ${successRate}%`;
}

// Handle save results
function handleSaveResults() {
  if (batchResultsData.length === 0) {
    showNotification("No results to save", true);
    return;
  }

  let content = "Netflix Cookies Checker - Batch Results\n";
  content += "Generated on: " + new Date().toLocaleString() + "\n";
  content += "Created by: Vonez powgie\n\n";
  content += "=".repeat(80) + "\n\n";

  let validCount = 0;
  let invalidCount = 0;

  batchResultsData.forEach((result) => {
    if (result.status === "success") {
      validCount++;
      const account = result.account_info;
      const token = result.token_result;

      content += `✅ ${result.filename}\n`;
      content += `NetflixId: ${result.netflix_id}\n`;
      content += `Status: ${account.ok ? "Valid" : "Invalid"}\n`;
      content += `Premium: ${account.premium ? "Yes" : "No"}\n`;
      content += `Country: ${account.country}\n`;
      content += `Plan: ${account.plan}\n`;
      content += `Price: ${account.plan_price}\n`;
      content += `Member Since: ${account.member_since}\n`;
      content += `Payment Method: ${account.payment_method}\n`;
      content += `Phone: ${account.phone}\n`;
      content += `Phone Verified: ${account.phone_verified}\n`;
      content += `Video Quality: ${account.video_quality}\n`;
      content += `Max Streams: ${account.max_streams}\n`;
      content += `Payment Hold: ${account.on_payment_hold}\n`;
      content += `Extra Member: ${account.extra_member}\n`;
      content += `Email: ${account.email}\n`;
      content += `Email Verified: ${account.email_verified}\n`;
      content += `Profiles: ${account.profiles}\n`;
      content += `Billing: ${account.next_billing}\n`;

      if (token.status === "Success") {
        content += `Token: ${token.token}\n`;
        content += `Login URL: ${token.direct_login_url}\n`;
        content += `Token Expires: ${new Date(token.expires * 1000).toLocaleString()}\n`;
        content += `Time Remaining: ${Math.floor(token.time_remaining / 86400)}d ${Math.floor((token.time_remaining % 86400) / 3600)}h ${Math.floor((token.time_remaining % 3600) / 60)}m\n`;
      } else {
        content += `Token Error: ${token.error}\n`;
      }

      content += "\n" + "─".repeat(80) + "\n\n";
    } else {
      invalidCount++;
      content += `❌ ${result.filename}: ${result.message}\n\n`;
      content += "─".repeat(80) + "\n\n";
    }
  });

  content += `\nSUMMARY\n`;
  content += `Total Files: ${batchResultsData.length}\n`;
  content += `Valid: ${validCount}\n`;
  content += `Invalid: ${invalidCount}\n`;
  content += `Success Rate: ${((validCount / batchResultsData.length) * 100).toFixed(2)}%\n`;

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `netflix_batch_results_${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showNotification("Results saved successfully");
}

// Display results - Updated for new design
function displayResults(data) {
  let html = "";

  if (currentMode === "fullinfo") {
    const account = data.account_info;

    html = `
            <div class="result-item">
                <div class="result-title">
                    <i class="fas fa-user-circle"></i>
                    ACCOUNT OVERVIEW
                    ${data.telegram_sent ? '<span style="background: var(--accent-cyan); color: var(--bg-primary); padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; margin-left: 10px;"><i class="fas fa-paper-plane"></i> Sent</span>' : ""}
                </div>
                <div class="result-content">
                    <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
                        <div style="background: ${account.ok ? "var(--accent-green)" : "var(--accent-pink)"}; color: var(--bg-primary); padding: 8px 16px; border-radius: 8px; font-weight: 700; font-size: 0.85rem; text-transform: uppercase;">
                            ${account.ok ? "VALID" : "INVALID"}
                        </div>
                        <div style="background: ${account.premium ? "var(--accent-orange)" : "var(--border)"}; color: ${account.premium ? "var(--bg-primary)" : "var(--text-primary)"}; padding: 8px 16px; border-radius: 8px; font-weight: 700; font-size: 0.85rem; text-transform: uppercase;">
                            ${account.premium ? "PREMIUM" : "BASIC"}
                        </div>
                        <div style="background: var(--accent-purple); color: var(--bg-primary); padding: 8px 16px; border-radius: 8px; font-weight: 700; font-size: 0.85rem; text-transform: uppercase;">
                            ${account.country}
                        </div>
                    </div>
                    
                    <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 20px; border: 1px solid var(--border);">
                        <div style="color: var(--accent-cyan); font-weight: 700; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px; font-size: 0.9rem;">
                            <i class="fas fa-id-card"></i> Account Details
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                            <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <span style="color: var(--text-secondary); font-size: 0.85rem;">Status:</span>
                                <span style="color: ${account.ok ? "var(--accent-green)" : "var(--accent-pink)"}; font-weight: 600;">${account.ok ? "Valid" : "Invalid"}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <span style="color: var(--text-secondary); font-size: 0.85rem;">Premium:</span>
                                <span style="color: ${account.premium ? "var(--accent-orange)" : "var(--text-secondary)"}; font-weight: 600;">${account.premium ? "Yes" : "No"}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <span style="color: var(--text-secondary); font-size: 0.85rem;">Country:</span>
                                <span style="color: var(--text-primary); font-weight: 600;">${account.country}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <span style="color: var(--text-secondary); font-size: 0.85rem;">Plan:</span>
                                <span style="color: var(--text-primary); font-weight: 600;">${account.plan}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <span style="color: var(--text-secondary); font-size: 0.85rem;">Price:</span>
                                <span style="color: var(--text-primary); font-weight: 600;">${account.plan_price}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <span style="color: var(--text-secondary); font-size: 0.85rem;">Member Since:</span>
                                <span style="color: var(--text-primary); font-weight: 600;">${account.member_since}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <span style="color: var(--text-secondary); font-size: 0.85rem;">Payment:</span>
                                <span style="color: var(--text-primary); font-weight: 600;">${account.payment_method}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <span style="color: var(--text-secondary); font-size: 0.85rem;">Phone Verified:</span>
                                <span style="color: ${account.phone_verified === "Yes" ? "var(--accent-green)" : "var(--accent-pink)"}; font-weight: 600;">${account.phone_verified}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <span style="color: var(--text-secondary); font-size: 0.85rem;">Email Verified:</span>
                                <span style="color: ${account.email_verified === "Yes" ? "var(--accent-green)" : "var(--accent-pink)"}; font-weight: 600;">${account.email_verified}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <span style="color: var(--text-secondary); font-size: 0.85rem;">Video Quality:</span>
                                <span style="color: var(--text-primary); font-weight: 600;">${account.video_quality}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <span style="color: var(--text-secondary); font-size: 0.85rem;">Max Streams:</span>
                                <span style="color: var(--text-primary); font-weight: 600;">${account.max_streams}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <span style="color: var(--text-secondary); font-size: 0.85rem;">Billing:</span>
                                <span style="color: var(--text-primary); font-weight: 600;">${account.next_billing}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
  }

  const token = data.token_result;
  if (token.status === "Success") {
    const genTime = new Date(token.generation_time * 1000).toLocaleString();
    const expTime = new Date(token.expires * 1000).toLocaleString();

    const days = Math.floor(token.time_remaining / 86400);
    const hours = Math.floor((token.time_remaining % 86400) / 3600);
    const minutes = Math.floor((token.time_remaining % 3600) / 60);
    const seconds = token.time_remaining % 60;

    html += `
            <div class="result-item">
                <div class="result-title">
                    <i class="fas fa-key"></i>
                    TOKEN INFORMATION
                </div>
                <div class="result-content">
                    <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 20px; border: 1px solid var(--border);">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px;">
                            <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <span style="color: var(--text-secondary); font-size: 0.85rem;">Status:</span>
                                <span style="color: var(--accent-green); font-weight: 600;">${token.status}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <span style="color: var(--text-secondary); font-size: 0.85rem;">Generated:</span>
                                <span style="color: var(--text-primary); font-weight: 600;">${genTime}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <span style="color: var(--text-secondary); font-size: 0.85rem;">Expires:</span>
                                <span style="color: var(--accent-pink); font-weight: 600;">${expTime}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                                <span style="color: var(--text-secondary); font-size: 0.85rem;">Remaining:</span>
                                <span style="color: var(--accent-cyan); font-weight: 600;">${days}d ${hours}h ${minutes}m ${seconds}s</span>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                            <div style="color: var(--accent-cyan); font-size: 0.85rem; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Login URL:</div>
                            <div style="background: rgba(0,0,0,0.5); padding: 15px; border-radius: 8px; word-break: break-all; font-family: 'Courier New', monospace; font-size: 0.85rem; color: var(--accent-cyan); border: 1px solid var(--border);">
                                ${token.direct_login_url}
                            </div>
                            <button class="btn btn-secondary" style="margin-top: 10px; width: 100%;" onclick="navigator.clipboard.writeText('${token.direct_login_url}').then(() => showNotification('URL copied!'))">
                                <i class="fas fa-copy"></i> Copy URL
                            </button>
                        </div>
                        
                        <div>
                            <div style="color: var(--accent-cyan); font-size: 0.85rem; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Token:</div>
                            <div style="background: rgba(0,0,0,0.5); padding: 15px; border-radius: 8px; word-break: break-all; font-family: 'Courier New', monospace; font-size: 0.85rem; color: var(--text-secondary); border: 1px solid var(--border);">
                                ${token.token}
                            </div>
                            <button class="btn btn-secondary" style="margin-top: 10px; width: 100%;" onclick="navigator.clipboard.writeText('${token.token}').then(() => showNotification('Token copied!'))">
                                <i class="fas fa-copy"></i> Copy Token
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
  } else {
    html += `
            <div class="result-item">
                <div class="result-title">
                    <i class="fas fa-times-circle" style="color: var(--accent-pink);"></i>
                    TOKEN ERROR
                </div>
                <div class="result-content">
                    <div style="background: rgba(255, 42, 109, 0.1); border: 1px solid var(--accent-pink); border-radius: 8px; padding: 15px; color: var(--accent-pink);">
                        ${token.error}
                    </div>
                </div>
            </div>
        `;
  }

  results.innerHTML = html;
  copyResultsBtn.disabled = false;
}

// Display error
function displayError(message) {
  results.innerHTML = `
        <div class="result-item">
            <div class="result-title">
                <i class="fas fa-times-circle" style="color: var(--accent-pink);"></i>
                Error
            </div>
            <div class="result-content">
                <div style="background: rgba(255, 42, 109, 0.1); border: 1px solid var(--accent-pink); border-radius: 8px; padding: 15px; color: var(--accent-pink);">
                    ${message}
                </div>
            </div>
        </div>
    `;
  copyResultsBtn.disabled = false;
}

// Show notification
function showNotification(message, isError = false) {
  notification.textContent = message;
  notification.className = "notification";

  if (isError) {
    notification.classList.add("error");
  }

  notification.classList.add("show");

  setTimeout(() => {
    notification.classList.remove("show");
  }, 3000);
}

// Telegram functionality
function loadTelegramConfig() {
  const savedConfig = localStorage.getItem("telegramConfig");
  if (savedConfig) {
    const config = JSON.parse(savedConfig);
    telegramToggle.checked = config.enabled || false;
    botTokenInput.value = config.bot_token || "";
    chatIdInput.value = config.chat_id || "";
    updateTelegramUI();
  }
}

function updateTelegramUI() {
  if (telegramToggle.checked) {
    telegramConfig.style.display = "block";
    telegramStatus.className = "telegram-status enabled";
    telegramStatus.innerHTML =
      '<i class="fas fa-check-circle"></i> Telegram Enabled';
  } else {
    telegramConfig.style.display = "none";
    telegramStatus.className = "telegram-status disabled";
    telegramStatus.innerHTML =
      '<i class="fas fa-times-circle"></i> Telegram Disabled';
  }
}

function saveTelegramConfig() {
  const config = {
    enabled: telegramToggle.checked,
    bot_token: botTokenInput.value,
    chat_id: chatIdInput.value,
  };
  localStorage.setItem("telegramConfig", JSON.stringify(config));
  fetch("/api/telegram-config", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.status === "success") {
        showNotification("Configuration saved");
      }
    })
    .catch((error) => {
      console.error("Error saving config:", error);
    });
}

function testTelegramConnection() {
  if (!botTokenInput.value || !chatIdInput.value) {
    showNotification("Please enter both Bot Token and Chat ID", true);
    return;
  }

  testTelegramBtn.disabled = true;
  testTelegramBtn.innerHTML = '<div class="spinner"></div> Testing...';
  telegramStatus.className = "telegram-status testing";
  telegramStatus.innerHTML = '<i class="fas fa-sync-alt"></i> Testing...';

  const testMessage = {
    chat_id: chatIdInput.value,
    text: "✅ *Netflix Checker Test*\n\nYour Telegram integration is working!",
    parse_mode: "Markdown",
  };

  fetch(`https://api.telegram.org/bot${botTokenInput.value}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(testMessage),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.ok) {
        telegramStatus.className = "telegram-status enabled";
        telegramStatus.innerHTML =
          '<i class="fas fa-check-circle"></i> Connection Successful';
        showNotification("Test message sent!");
      } else {
        telegramStatus.className = "telegram-status disabled";
        telegramStatus.innerHTML = `<i class="fas fa-times-circle"></i> Error: ${data.description}`;
        showNotification("Test failed: " + data.description, true);
      }
    })
    .catch((error) => {
      telegramStatus.className = "telegram-status disabled";
      telegramStatus.innerHTML =
        '<i class="fas fa-times-circle"></i> Connection Failed';
      showNotification("Network error", true);
    })
    .finally(() => {
      testTelegramBtn.disabled = false;
      testTelegramBtn.innerHTML =
        '<i class="fas fa-check-circle"></i> Test Connection';
    });
}

function initTelegram() {
  loadTelegramConfig();

  telegramToggle.addEventListener("change", function () {
    updateTelegramUI();
    saveTelegramConfig();
  });

  botTokenInput.addEventListener("input", saveTelegramConfig);
  chatIdInput.addEventListener("input", saveTelegramConfig);
  testTelegramBtn.addEventListener("click", testTelegramConnection);

  updateTelegramUI();
}
