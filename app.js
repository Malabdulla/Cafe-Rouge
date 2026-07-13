// Cafe Rouge Web App Logic - Simplified Menu Viewer

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

// DOM Elements
const header = document.getElementById("header");
const menuTabsList = document.getElementById("categories-tabs-list");
const menuGrid = document.getElementById("menu-grid-items");
const searchInput = document.getElementById("menu-search-input");
const mobileMenuBtn = document.getElementById("menu-toggle-btn");
const navMenu = document.getElementById("nav-menu");

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
