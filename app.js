// Cafe Rouge Web App Logic - Menu Viewer & VIP Membership Portal

// Category mapping for user-friendly display titles and emojis
const CATEGORY_META = {
  "breakfast": { title: "Breakfast", icon: "🍳" },
  "burgers": { title: "Burgers", icon: "🍔" },
  "cocktails": { title: "Cocktails & Milkshakes", icon: "🍹" },
  "coffee": { title: "Espresso & Coffee", icon: "☕" },
  "cold starters": { title: "Cold Starters", icon: "🥗" },
  "desserts": { title: "Desserts", icon: "🍰" },
  "drinks and juices": { title: "Drinks & Juices", icon: "🥤" },
  "grills": { title: "Grills", icon: "🍢" },
  "hot starters": { title: "Hot Starters", icon: "🍟" },
  "hot tea": { title: "Hot Tea & Sahlab", icon: "🍵" },
  "main course": { title: "Main Course", icon: "🍽️" },
  "pasta,risoto,pizza": { title: "Pasta & Pizza", icon: "🍕" },
  "salads": { title: "Salads", icon: "🥗" },
  "sandwich": { title: "Sandwiches", icon: "🥪" },
  "shisha": { title: "Shisha", icon: "💨" },
  "side dishes": { title: "Side Dishes", icon: "🥔" },
  "soup": { title: "Soups", icon: "🥣" }
};

// State Variables
let activeCategory = "breakfast";
let searchQuery = "";

// Membership Auth State
let userToken = localStorage.getItem("caferouge_user_token") || null;
let userProfile = null;
let subscription = null;
let sessionConfig = null;
let selectedTier = null;

// DOM Elements
const header = document.getElementById("header");
const menuTabsList = document.getElementById("categories-tabs-list");
const menuGrid = document.getElementById("menu-grid-items");
const searchInput = document.getElementById("menu-search-input");
const mobileMenuBtn = document.getElementById("menu-toggle-btn");
const navMenu = document.getElementById("nav-menu");

// Membership Modal Elements
const membershipLink = document.getElementById("nav-membership-link");
const membershipDrawer = document.getElementById("membership-drawer");
const membershipOverlay = document.getElementById("membership-overlay");
const membershipCloseBtn = document.getElementById("membership-close-btn");
const portalContent = document.getElementById("membership-portal-content");

// Init application
document.addEventListener("DOMContentLoaded", () => {
  // Sticky header on scroll
  window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  });

  // Mobile menu toggle
  mobileMenuBtn.addEventListener("click", () => {
    navMenu.classList.toggle("open");
    const icon = mobileMenuBtn.querySelector("i");
    if (navMenu.classList.contains("open")) {
      icon.className = "fa-solid fa-xmark";
    } else {
      icon.className = "fa-solid fa-bars";
    }
  });

  // Close mobile menu when links are clicked
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
      navMenu.classList.remove("open");
      mobileMenuBtn.querySelector("i").className = "fa-solid fa-bars";
    });
  });

  // Populate category tabs & items
  renderCategoryTabs();
  renderMenuItems();

  // Search Input listener
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderMenuItems();
  });

  // Membership Event Listeners
  if (membershipLink) membershipLink.addEventListener("click", openMembershipPortal);
  if (membershipCloseBtn) membershipCloseBtn.addEventListener("click", closeMembershipPortal);
  if (membershipOverlay) membershipOverlay.addEventListener("click", closeMembershipPortal);

  // Fetch initial profile if logged in
  if (userToken) {
    fetchProfile();
  }
});

// Render Category Tabs horizontally
function renderCategoryTabs() {
  if (!menuTabsList) return;
  menuTabsList.innerHTML = "";

  MENU_DATA.forEach(cat => {
    const meta = CATEGORY_META[cat.category] || { title: cat.category, icon: "🍽️" };
    const isActive = cat.category === activeCategory ? "active" : "";
    
    const tabLi = document.createElement("li");
    tabLi.innerHTML = `
      <button class="category-tab ${isActive}" data-category="${cat.category}">
        <span>${meta.icon}</span> ${meta.title}
      </button>
    `;
    
    tabLi.querySelector("button").addEventListener("click", () => {
      activeCategory = cat.category;
      searchQuery = ""; // Clear search on tab change
      searchInput.value = "";
      
      // Update active classes
      document.querySelectorAll(".category-tab").forEach(tab => {
        tab.classList.remove("active");
      });
      tabLi.querySelector("button").classList.add("active");
      
      renderMenuItems();
    });
    
    menuTabsList.appendChild(tabLi);
  });
}

// Render Menu Items based on category filter or search query
function renderMenuItems() {
  if (!menuGrid) return;
  menuGrid.innerHTML = "";

  let itemsToRender = [];

  if (searchQuery.length > 0) {
    // Search across all categories
    MENU_DATA.forEach(cat => {
      cat.items.forEach(item => {
        if (item.name.toLowerCase().includes(searchQuery) || cat.category.toLowerCase().includes(searchQuery)) {
          itemsToRender.push({ ...item, category: cat.category });
        }
      });
    });
  } else {
    // Render current active category
    const catData = MENU_DATA.find(cat => cat.category === activeCategory);
    if (catData) {
      itemsToRender = catData.items.map(item => ({ ...item, category: catData.category }));
    }
  }

  // Handle empty state
  if (itemsToRender.length === 0) {
    menuGrid.innerHTML = `
      <div class="no-results">
        <div class="no-results-icon"><i class="fa-solid fa-utensils"></i></div>
        <h3>No items found</h3>
        <p>Try searching for a different keyword or category.</p>
      </div>
    `;
    return;
  }

  // Generate cards
  itemsToRender.forEach(item => {
    const card = document.createElement("div");
    card.className = "item-card glass";
    
    // Check if image exists, else use placeholder
    const imageTag = item.image 
      ? `<img src="${item.image}" alt="${item.name}" class="item-img" loading="lazy" onerror="handleImgError(this, '${item.category}')">`
      : `<div class="item-placeholder-img">
           <i class="fa-solid fa-utensils"></i>
           <span>${CATEGORY_META[item.category]?.title || item.category}</span>
         </div>`;

    const categoryTitle = CATEGORY_META[item.category]?.title || item.category;

    card.innerHTML = `
      <div class="item-img-container">
        ${imageTag}
        <span class="item-badge">${categoryTitle}</span>
      </div>
      <div class="item-info">
        <div class="item-header">
          <h3 class="item-title">${item.name}</h3>
          <p class="item-desc">${item.description}</p>
        </div>
        <div class="item-footer" style="justify-content: center; margin-top: 1rem;">
          <span class="item-price" style="font-size: 1.3rem;">${item.price.toFixed(3)} BHD</span>
        </div>
      </div>
    `;

    menuGrid.appendChild(card);
  });
}

// Fallback image handler
function handleImgError(img, category) {
  img.style.display = "none";
  const parent = img.parentElement;
  
  // Create placeholder div
  const placeholder = document.createElement("div");
  placeholder.className = "item-placeholder-img";
  placeholder.innerHTML = `
    <i class="fa-solid fa-utensils"></i>
    <span>${CATEGORY_META[category]?.title || category}</span>
  `;
  parent.appendChild(placeholder);
}

// ----------------- MEMBERSHIP LOGIC & UI RENDERING -----------------

function openMembershipPortal(e) {
  if (e) e.preventDefault();
  if (membershipDrawer) membershipDrawer.classList.add("open");
  if (membershipOverlay) membershipOverlay.classList.add("show");
  document.body.style.overflow = "hidden";
  renderMembershipView();
}

function closeMembershipPortal() {
  if (membershipDrawer) membershipDrawer.classList.remove("open");
  if (membershipOverlay) membershipOverlay.classList.remove("show");
  document.body.style.overflow = "";
}

// Fetch user profile from API
async function fetchProfile() {
  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    if (res.ok) {
      const data = await res.json();
      userProfile = data.user;
      subscription = data.subscription;
      if (membershipDrawer && membershipDrawer.classList.contains("open")) {
        renderMembershipView();
      }
    } else {
      signOut();
    }
  } catch (err) {
    console.error("Error fetching user profile:", err);
  }
}

// Main View Router for Membership Portal
function renderMembershipView() {
  if (!portalContent) return;

  if (!userToken) {
    // Show Unified Register & Subscribe Screen by default
    renderRegisterView();
  } else if (!userProfile) {
    // Loading State
    portalContent.innerHTML = `<div style="text-align: center; padding: 3rem;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--accent-gold);"></i></div>`;
  } else if (!subscription || subscription.status !== 'active') {
    // Show Checkout directly for VIP membership (27.000 BHD)
    selectedTier = { name: "VIP Member", price: 27.000 };
    renderCheckoutView();
  } else {
    // Show VIP Member Dashboard
    renderDashboardView();
  }
}

// Render Login Screen
function renderLoginView() {
  portalContent.innerHTML = `
    <h4 style="font-family: var(--font-serif); font-size: 1.8rem; text-align: center; margin-bottom: 2rem; color: var(--accent-gold);">VIP Member Sign In</h4>
    <form id="auth-login-form" style="display: flex; flex-direction: column; gap: 1.2rem;">
      <div class="form-group">
        <label class="form-label">Email Address</label>
        <input type="email" id="login-email" class="form-input" required placeholder="email@example.com">
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <input type="password" id="login-password" class="form-input" required placeholder="••••••••">
      </div>
      <button type="submit" class="btn-primary" style="margin-top: 1rem;">Sign In</button>
      <p style="text-align: center; margin-top: 1rem; font-size: 0.9rem; color: var(--text-secondary);">
        New to Cafe Rouge? <a href="#" id="go-to-register" style="color: var(--accent-gold); text-decoration: none; font-weight: 600;">Create account</a>
      </p>
    </form>
  `;

  // Submit Handler
  document.getElementById("auth-login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      
      userToken = data.token;
      userProfile = data.user;
      localStorage.setItem("caferouge_user_token", userToken);
      fetchProfile();
    } catch (err) {
      alert(err.message);
    }
  });

  // Switch to register link
  document.getElementById("go-to-register").addEventListener("click", (e) => {
    e.preventDefault();
    renderRegisterView();
  });
}

// Render Registration Screen (Unified Membership Sign-Up)
function renderRegisterView() {
  portalContent.innerHTML = `
    <div style="text-align: center; margin-bottom: 1.5rem;">
      <h4 style="font-family: var(--font-serif); font-size: 1.8rem; color: var(--accent-gold); margin-bottom: 0.3rem;">Join VIP Club</h4>
      <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.8rem;">Unlock premium benefits and private lounge access.</p>
      <div style="background: rgba(184, 134, 11, 0.1); border: 1px solid var(--accent-gold); padding: 0.6rem; border-radius: 6px; font-weight: 700; color: var(--accent-gold); display: inline-block;">
        27.000 BHD <span style="font-size: 0.8rem; font-weight: 400; color: var(--text-muted);">/ month</span>
      </div>
    </div>
    
    <form id="auth-register-form" style="display: flex; flex-direction: column; gap: 1rem;">
      <div class="form-group">
        <label class="form-label">Full Name</label>
        <input type="text" id="reg-name" class="form-input" required placeholder="Your Name">
      </div>
      <div class="form-group">
        <label class="form-label">Phone Number</label>
        <input type="tel" id="reg-phone" class="form-input" required placeholder="+973 XXXXXXXX">
      </div>
      <div class="form-group">
        <label class="form-label">Email Address</label>
        <input type="email" id="reg-email" class="form-input" required placeholder="email@example.com">
      </div>
      <div class="form-group">
        <label class="form-label">Create Password</label>
        <input type="password" id="reg-password" class="form-input" required placeholder="Min 6 characters">
      </div>
      <button type="submit" class="btn-primary" style="margin-top: 1rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
        <i class="fa-solid fa-crown"></i> Subscribe
      </button>
      <p style="text-align: center; margin-top: 1rem; font-size: 0.9rem; color: var(--text-secondary);">
        Already a VIP member? <a href="#" id="go-to-login" style="color: var(--accent-gold); text-decoration: none; font-weight: 600;">Sign in</a>
      </p>
    </form>
  `;

  // Submit Handler
  document.getElementById("auth-register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("reg-name").value;
    const email = document.getElementById("reg-email").value;
    const phone = document.getElementById("reg-phone").value;
    const password = document.getElementById("reg-password").value;
    
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      
      userToken = data.token;
      userProfile = data.user;
      localStorage.setItem("caferouge_user_token", userToken);
      fetchProfile();
    } catch (err) {
      alert(err.message);
    }
  });

  // Switch to login link
  document.getElementById("go-to-login").addEventListener("click", (e) => {
    e.preventDefault();
    renderLoginView();
  });
}

// Render Membership Tier Options
function renderTierSelectionView() {
  portalContent.innerHTML = `
    <div style="text-align: center; margin-bottom: 2rem;">
      <h4 style="font-family: var(--font-serif); font-size: 1.8rem; color: var(--accent-gold); margin-bottom: 0.5rem;">Select Membership Tier</h4>
      <p style="color: var(--text-secondary); font-size: 0.95rem;">Unlock premium benefits and private lounge access.</p>
    </div>
    
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <!-- Silver Tier -->
      <div class="glass" style="padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); cursor: pointer;" id="tier-silver-btn">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
          <h5 style="font-family: var(--font-serif); font-size: 1.4rem; color: #fff;">Silver VIP</h5>
          <span style="font-size: 1.25rem; font-weight: 700; color: var(--accent-gold);">10.000 BHD <span style="font-size: 0.8rem; font-weight: 400; color: var(--text-muted);">/ mo</span></span>
        </div>
        <ul style="list-style: none; color: var(--text-secondary); font-size: 0.9rem; padding-left: 0.5rem; display: flex; flex-direction: column; gap: 0.4rem;">
          <li><i class="fa-solid fa-check" style="color: var(--accent-gold); margin-right: 0.5rem;"></i> 10% Discount on all menu items</li>
          <li><i class="fa-solid fa-check" style="color: var(--accent-gold); margin-right: 0.5rem;"></i> 1 Free Specialty Coffee daily</li>
          <li><i class="fa-solid fa-check" style="color: var(--accent-gold); margin-right: 0.5rem;"></i> Priority Table Reservation access</li>
        </ul>
      </div>

      <!-- Gold Tier -->
      <div class="glass" style="padding: 1.5rem; border-radius: 8px; border: 1px solid var(--accent-gold); cursor: pointer; position: relative;" id="tier-gold-btn">
        <span style="position: absolute; top: -10px; right: 20px; background: var(--accent-crimson); color: #fff; padding: 0.2rem 0.8rem; border-radius: 50px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase;">Most Popular</span>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
          <h5 style="font-family: var(--font-serif); font-size: 1.4rem; color: var(--accent-gold);">Gold VIP</h5>
          <span style="font-size: 1.25rem; font-weight: 700; color: var(--accent-gold);">25.000 BHD <span style="font-size: 0.8rem; font-weight: 400; color: var(--text-muted);">/ mo</span></span>
        </div>
        <ul style="list-style: none; color: var(--text-secondary); font-size: 0.9rem; padding-left: 0.5rem; display: flex; flex-direction: column; gap: 0.4rem;">
          <li><i class="fa-solid fa-check" style="color: var(--accent-gold); margin-right: 0.5rem;"></i> 20% Discount on all menu items</li>
          <li><i class="fa-solid fa-check" style="color: var(--accent-gold); margin-right: 0.5rem;"></i> 1 Free Specialty Coffee/Tea daily</li>
          <li><i class="fa-solid fa-check" style="color: var(--accent-gold); margin-right: 0.5rem;"></i> 1 Free Shisha or Dessert daily</li>
          <li><i class="fa-solid fa-check" style="color: var(--accent-gold); margin-right: 0.5rem;"></i> VIP Lounge access & free valeting</li>
        </ul>
      </div>
      
      <button class="btn-secondary" id="logout-btn" style="margin-top: 1rem;">Sign Out</button>
    </div>
  `;

  // Click Handlers
  document.getElementById("tier-silver-btn").addEventListener("click", () => {
    selectedTier = { name: "Silver VIP", price: 10.000 };
    renderMembershipView();
  });

  document.getElementById("tier-gold-btn").addEventListener("click", () => {
    selectedTier = { name: "Gold VIP", price: 25.000 };
    renderMembershipView();
  });

  document.getElementById("logout-btn").addEventListener("click", signOut);
}

// Render Credit Card Form using EazyPay integration
async function renderCheckoutView() {
  portalContent.innerHTML = `
    <button class="btn-secondary" id="back-to-tiers" style="padding: 0.5rem 1rem; font-size: 0.85rem; margin-bottom: 1.5rem;">
      <i class="fa-solid fa-arrow-left"></i> Cancel & Sign Out
    </button>
    
    <div style="margin-bottom: 2rem;">
      <h4 style="font-family: var(--font-serif); font-size: 1.6rem; color: var(--accent-gold); margin-bottom: 0.2rem;">Complete Subscription</h4>
      <p style="color: var(--text-secondary); font-size: 0.9rem;">You are subscribing to <strong>${selectedTier.name}</strong> for <strong>${selectedTier.price.toFixed(3)} BHD / month</strong>.</p>
    </div>

    <!-- EazyPay Secure Card Form -->
    <form id="eazypay-checkout-form" style="display: flex; flex-direction: column; gap: 1.2rem;">
      <div id="card-fields-container" style="display: flex; flex-direction: column; gap: 1.2rem;">
        <!-- Card Fields will render inside this container -->
      </div>
      <button type="submit" class="btn-primary" id="pay-btn" style="margin-top: 1rem; display: flex; align-items: center; justify-content: center; gap: 0.8rem;">
        <i class="fa-solid fa-lock"></i> Securely Pay & Subscribe
      </button>
    </form>
  `;

  document.getElementById("back-to-tiers").addEventListener("click", () => {
    signOut();
  });

  // Fetch session config from backend
  try {
    const res = await fetch('/api/payment/session', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to initialize payment gateway');
    sessionConfig = data;

    const fieldsContainer = document.getElementById("card-fields-container");

    if (sessionConfig.mode === 'simulator') {
      // Render simulated card inputs
      fieldsContainer.innerHTML = `
        <div style="background: rgba(43,75,55,0.1); border: 1px solid rgba(43,75,55,0.3); padding: 0.8rem; border-radius: 6px; font-size: 0.8rem; color: #a3e635; display: flex; gap: 0.5rem; align-items: center;">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>Simulated Gateway Mode Active. Enter any details to test.</span>
        </div>
        <div class="form-group">
          <label class="form-label">Card Number</label>
          <input type="text" class="form-input" placeholder="4000 1234 5678 9010" required>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group">
            <label class="form-label">Expiry Date</label>
            <input type="text" class="form-input" placeholder="MM/YY" required>
          </div>
          <div class="form-group">
            <label class="form-label">Security Code (CVV)</label>
            <input type="password" class="form-input" placeholder="123" required>
          </div>
        </div>
      `;

      // Handle simulated submit
      document.getElementById("eazypay-checkout-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const payBtn = document.getElementById("pay-btn");
        payBtn.disabled = true;
        payBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing...`;

        try {
          const subRes = await fetch('/api/payment/subscribe', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${userToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              sessionId: sessionConfig.session.id,
              tier: selectedTier.name,
              price: selectedTier.price
            })
          });

          const subData = await subRes.json();
          if (!subRes.ok) throw new Error(subData.error || 'Failed to complete subscription');
          
          alert('Welcome to VIP Club! Payment approved.');
          selectedTier = null;
          fetchProfile();
        } catch (err) {
          alert(err.message);
          payBtn.disabled = false;
          payBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Securely Pay & Subscribe`;
        }
      });

    } else {
      // Real EazyPay / Mastercard Gateway script integration
      fieldsContainer.innerHTML = `
        <div class="form-group">
          <label class="form-label">Card Number</label>
          <div id="eazypay-card-number-container" class="form-input" style="height: 45px;"></div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group">
            <label class="form-label">Expiry Date</label>
            <div style="display: flex; gap: 0.5rem;">
              <div id="eazypay-expiry-month-container" class="form-input" style="height: 45px; flex: 1;"></div>
              <div id="eazypay-expiry-year-container" class="form-input" style="height: 45px; flex: 1;"></div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">CVV Code</label>
            <div id="eazypay-security-code-container" class="form-input" style="height: 45px;"></div>
          </div>
        </div>
      `;

      // Dynamically load the hosted fields script from EazyPay
      loadEazyPaySdkScript(() => {
        // Initialize Hosted Fields API
        PaymentSession.configure({
          fields: {
            card: {
              number: "#eazypay-card-number-container",
              securityCode: "#eazypay-security-code-container",
              expiryMonth: "#eazypay-expiry-month-container",
              expiryYear: "#eazypay-expiry-year-container"
            }
          },
          frameEmbeddingMitigation: ["javascript"],
          callbacks: {
            initialized: function (response) {
              console.log("Mastercard Gateway Session Fields Initialized");
            },
            formSessionUpdate: async function (response) {
              if (response.status === "ok") {
                // Session updated successfully, now send session ID to backend to capture payment
                try {
                  const subRes = await fetch('/api/payment/subscribe', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${userToken}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      sessionId: response.session.id,
                      tier: selectedTier.name,
                      price: selectedTier.price
                    })
                  });

                  const subData = await subRes.json();
                  if (!subRes.ok) throw new Error(subData.error || 'Failed to complete subscription');
                  
                  alert('Welcome to Cafe Rouge VIP Club!');
                  selectedTier = null;
                  fetchProfile();
                } catch (err) {
                  alert(err.message);
                  resetPayButton();
                }
              } else {
                alert("Payment details verification failed: " + response.errors.map(e => e.explanation).join(", "));
                resetPayButton();
              }
            }
          },
          interaction: {
            merchant: {
              name: "Cafe Rouge Bahrain"
            }
          }
        });
      });

      // Submit Form
      document.getElementById("eazypay-checkout-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const payBtn = document.getElementById("pay-btn");
        payBtn.disabled = true;
        payBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Authorizing card...`;
        
        // Trigger hosted fields to update session card details
        PaymentSession.updateSessionFromForm('card');
      });
    }

  } catch (err) {
    fieldsContainer.innerHTML = `<p style="color: var(--accent-crimson); text-align: center;">Error: ${err.message}</p>`;
  }
}

// Reset checkout pay button state
function resetPayButton() {
  const payBtn = document.getElementById("pay-btn");
  if (payBtn) {
    payBtn.disabled = false;
    payBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Securely Pay & Subscribe`;
  }
}

// Dynamically load Mastercard Gateway SDK session.js script
function loadEazyPaySdkScript(callback) {
  const scriptId = 'eazypay-gateway-sdk-script';
  let script = document.getElementById(scriptId);
  
  if (script) {
    callback();
    return;
  }

  const merchantId = (sessionConfig && sessionConfig.merchant) || 'TEST';

  // Load test gateway form script
  script = document.createElement('script');
  script.id = scriptId;
  script.src = `https://eazypay.test.gateway.mastercard.com/form/version/65/merchant/${merchantId}/session.js`;
  script.onload = callback;
  script.onerror = () => {
    alert("Failed to load payment gateway library. Please check connection.");
    resetPayButton();
  };
  
  document.head.appendChild(script);
}

// Render VIP Member Dashboard View
function renderDashboardView() {
  const nextBilling = subscription.next_billing_date;
  
  portalContent.innerHTML = `
    <!-- Luxury virtual member card -->
    <div class="glass" style="
      background: linear-gradient(135deg, hsl(348, 45%, 8%), hsl(348, 30%, 15%));
      border: 1px solid var(--accent-gold);
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      border-radius: 12px;
      padding: 2rem;
      position: relative;
      overflow: hidden;
      aspect-ratio: 1.6/1;
      margin-bottom: 2rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    ">
      <!-- background styling design -->
      <div style="position: absolute; right: -20px; bottom: -20px; font-size: 8rem; opacity: 0.05; color: var(--accent-gold); font-family: var(--font-serif); font-weight: 700; transform: rotate(-10deg);">VIP</div>
      <div style="position: absolute; right: 2rem; top: 1.5rem; color: var(--accent-gold); font-size: 1.5rem;"><i class="fa-solid fa-crown"></i></div>
      
      <div>
        <h5 style="font-family: var(--font-serif); font-size: 1.5rem; font-weight: 700; letter-spacing: 1px; color: #fff; margin-bottom: 0.2rem;">Cafe Rouge</h5>
        <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--accent-gold); font-weight: 600; letter-spacing: 3px;">VIP Member</span>
      </div>

      <div style="margin-top: 1.5rem;">
        <span style="display: block; font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 1px;">Card Holder</span>
        <span style="font-size: 1.2rem; font-weight: 600; color: var(--text-primary);">${userProfile.name}</span>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 1rem;">
        <div>
          <span style="display: block; font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 1px;">Tier level</span>
          <span style="font-size: 1rem; font-weight: 700; color: var(--accent-gold); text-transform: uppercase;">${subscription.tier}</span>
        </div>
        <div style="text-align: right;">
          <span style="display: block; font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 1px;">Renewal Date</span>
          <span style="font-size: 0.95rem; font-weight: 600; color: #fff;">${nextBilling}</span>
        </div>
      </div>
    </div>

    <!-- Membership Details List -->
    <div style="display: flex; flex-direction: column; gap: 1.2rem; margin-bottom: 2rem;">
      <h5 style="font-family: var(--font-serif); font-size: 1.3rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; color: var(--accent-gold);">Your Member Benefits</h5>
      <ul style="list-style: none; display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.95rem; color: var(--text-secondary);">
        <li><i class="fa-solid fa-circle-check" style="color: var(--accent-gold); margin-right: 0.6rem;"></i> Present this digital card to your server to redeem discounts.</li>
        <li><i class="fa-solid fa-circle-check" style="color: var(--accent-gold); margin-right: 0.6rem;"></i> Premium priority valet and lounge entrance included.</li>
        <li><i class="fa-solid fa-circle-check" style="color: var(--accent-gold); margin-right: 0.6rem;"></i> 24/7 Priority hotline for VIP reservations.</li>
      </ul>
    </div>

    <div style="display: flex; gap: 1rem;">
      <button class="btn-secondary" id="logout-btn" style="flex: 1;">Sign Out</button>
    </div>
  `;

  document.getElementById("logout-btn").addEventListener("click", signOut);
}

// Sign out and clean state
function signOut() {
  userToken = null;
  userProfile = null;
  subscription = null;
  selectedTier = null;
  sessionConfig = null;
  localStorage.removeItem("caferouge_user_token");
  renderMembershipView();
}
