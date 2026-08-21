/* ═══════════════════════════════════════════════════════════════
   FOODIE EXPRESS — Main Application JavaScript
   ═══════════════════════════════════════════════════════════════ */
'use strict';

/* ─── Config ─────────────────────────────────────────────────── */
const CONFIG = {
  API_BASE: 'http://localhost:5000/api',
  RAZORPAY_KEY: 'rzp_test_your_key_here'
};

/* ─── Path Helper ────────────────────────────────────────────── */
function isInPagesFolder() {
  return window.location.pathname.includes('/pages/');
}
function rootPath(path) {
  return (isInPagesFolder() ? '../' : '') + path;
}
function pagesPath(page) {
  return isInPagesFolder() ? page : 'pages/' + page;
}

/* ─── AppState ───────────────────────────────────────────────── */
const AppState = {
  user: null,
  token: null,
  cart: [],
  theme: 'light',

  init() {
    try { this.user  = JSON.parse(localStorage.getItem('fe_user') || 'null'); } catch(e) { this.user = null; }
    this.token = localStorage.getItem('fe_token') || null;
    try { this.cart  = JSON.parse(localStorage.getItem('fe_cart') || '[]'); } catch(e) { this.cart = []; }
    this.theme = localStorage.getItem('fe_theme') || 'light';
  },
  setUser(u)  { this.user  = u; localStorage.setItem('fe_user',  JSON.stringify(u)); },
  setToken(t) { this.token = t; localStorage.setItem('fe_token', t); },
  clearAuth() {
    this.user = null; this.token = null;
    localStorage.removeItem('fe_user'); localStorage.removeItem('fe_token');
  },
  saveCart()  { localStorage.setItem('fe_cart', JSON.stringify(this.cart)); }
};
AppState.init();

/* ─── API ────────────────────────────────────────────────────── */
const API = {
  async request(method, endpoint, data) {
    const headers = { 'Content-Type': 'application/json' };
    if (AppState.token) headers['Authorization'] = 'Bearer ' + AppState.token;
    const opts = { method, headers };
    if (data) opts.body = JSON.stringify(data);
    const res = await fetch(CONFIG.API_BASE + endpoint, opts);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Request failed');
    return json;
  },
  get:    (ep)       => API.request('GET',    ep),
  post:   (ep, data) => API.request('POST',   ep, data),
  put:    (ep, data) => API.request('PUT',    ep, data),
  delete: (ep)       => API.request('DELETE', ep)
};

/* ─── Toast ──────────────────────────────────────────────────── */
const Toast = {
  container: null,
  init() { this.container = document.getElementById('toast-container'); },
  show(message, type, duration) {
    if (!this.container) return;
    type = type || 'info';
    duration = duration || 3500;
    const icons = { success: '✅', error: '❌', info: '🍔', warning: '⚠️' };
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = '<span class="toast-icon">' + icons[type] + '</span><span class="toast-message">' + message + '</span>';
    this.container.appendChild(t);
    setTimeout(function() {
      t.classList.add('removing');
      setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
    }, duration);
  },
  success: function(m) { Toast.show(m, 'success'); },
  error:   function(m) { Toast.show(m, 'error'); },
  info:    function(m) { Toast.show(m, 'info'); }
};

/* ─── Cart ───────────────────────────────────────────────────── */
const Cart = {
  get items() { return AppState.cart; },
  set items(v) { AppState.cart = v; },

  add(item) {
    const existing = this.items.find(function(i) { return i.foodItemId === item.foodItemId; });
    if (existing) {
      if (this.items.length > 0 && this.items[0].restaurantId !== item.restaurantId) {
        if (!confirm('Your cart has items from another restaurant. Clear and add new item?')) return false;
        this.clear();
      } else {
        existing.quantity += 1;
        this.save();
        Toast.success(item.name + ' quantity updated!');
        this.animateCartIcon();
        return true;
      }
    }
    if (this.items.length > 0 && this.items[0].restaurantId !== item.restaurantId) {
      if (!confirm('Your cart has items from another restaurant. Clear and add new item?')) return false;
      this.clear();
    }
    this.items.push({ foodItemId: item.foodItemId, name: item.name, image: item.image || '', price: item.price, restaurantId: item.restaurantId, quantity: 1 });
    this.save();
    this.animateCartIcon();
    Toast.success(item.name + ' added to cart! 🛒');
    return true;
  },

  remove(foodItemId) {
    AppState.cart = this.items.filter(function(i) { return i.foodItemId !== foodItemId; });
    this.save();
  },

  updateQty(foodItemId, qty) {
    if (qty <= 0) { this.remove(foodItemId); return; }
    const item = this.items.find(function(i) { return i.foodItemId === foodItemId; });
    if (item) item.quantity = qty;
    this.save();
  },

  getQuantity(foodItemId) {
    const item = this.items.find(function(i) { return i.foodItemId === foodItemId; });
    return item ? item.quantity : 0;
  },

  get total() { return this.items.reduce(function(s, i) { return s + i.price * i.quantity; }, 0); },
  get count() { return this.items.reduce(function(s, i) { return s + i.quantity; }, 0); },

  clear() { AppState.cart = []; this.save(); },

  save() { AppState.saveCart(); this.updateUI(); },

  animateCartIcon() {
    const btn = document.querySelector('.cart-btn');
    if (!btn) return;
    btn.style.transform = 'scale(1.2)';
    setTimeout(function() { btn.style.transform = ''; }, 300);
  },

  updateUI() {
    const countEl = document.querySelector('.cart-count');
    const count = this.count;
    if (countEl) {
      countEl.textContent = count;
      countEl.style.display = count > 0 ? 'flex' : 'none';
    }
    CartSidebar.render();
  }
};

/* ─── CartSidebar ────────────────────────────────────────────── */
const CartSidebar = {
  couponDiscount: 0,
  appliedCoupon: null,

  open() {
    const s = document.getElementById('cart-sidebar');
    const o = document.getElementById('cart-overlay');
    if (s) s.classList.add('open');
    if (o) o.classList.add('open');
    document.body.style.overflow = 'hidden';
    this.render();
  },
  close() {
    const s = document.getElementById('cart-sidebar');
    const o = document.getElementById('cart-overlay');
    if (s) s.classList.remove('open');
    if (o) o.classList.remove('open');
    document.body.style.overflow = '';
  },

  render() {
    const container = document.getElementById('cart-items');
    if (!container) return;
    if (Cart.items.length === 0) {
      container.innerHTML = '<div class="empty-cart"><div class="empty-icon">🛒</div><p>Your cart is empty</p><p style="font-size:0.85rem;color:var(--text-muted);margin-top:8px">Add delicious food to get started!</p></div>';
      this.renderSummary(0);
      return;
    }
    container.innerHTML = Cart.items.map(function(item) {
      return '<div class="cart-item">' +
        '<img class="cart-item-img" src="' + (item.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=64') + '" alt="' + item.name + '" onerror="this.src=\'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=64\'">' +
        '<div class="cart-item-info">' +
          '<div class="cart-item-name">' + item.name + '</div>' +
          '<div class="cart-item-price">₹' + item.price + ' × ' + item.quantity + ' = ₹' + (item.price * item.quantity) + '</div>' +
        '</div>' +
        '<div class="cart-item-qty">' +
          '<button class="cart-qty-btn" onclick="Cart.updateQty(\'' + item.foodItemId + '\',' + (item.quantity - 1) + ')">−</button>' +
          '<span style="font-weight:700;min-width:20px;text-align:center">' + item.quantity + '</span>' +
          '<button class="cart-qty-btn" onclick="Cart.updateQty(\'' + item.foodItemId + '\',' + (item.quantity + 1) + ')">+</button>' +
        '</div>' +
      '</div>';
    }).join('');
    this.renderSummary(Cart.total);
  },

  renderSummary(subtotal) {
    const el = document.getElementById('cart-summary');
    if (!el) return;
    const deliveryFee = subtotal > 0 ? (subtotal >= 400 ? 0 : 30) : 0;
    const taxes = Math.round(subtotal * 0.05);
    const total = Math.max(0, subtotal + deliveryFee + taxes - this.couponDiscount);
    el.innerHTML =
      '<div class="cart-row"><span>Subtotal</span><span>₹' + subtotal + '</span></div>' +
      '<div class="cart-row"><span>Delivery Fee</span><span>' + (deliveryFee === 0 && subtotal > 0 ? '<span style="color:#16A34A">FREE</span>' : '₹' + deliveryFee) + '</span></div>' +
      '<div class="cart-row"><span>Taxes (5%)</span><span>₹' + taxes + '</span></div>' +
      (this.couponDiscount > 0 ? '<div class="cart-row discount"><span>Coupon Discount</span><span>-₹' + this.couponDiscount + '</span></div>' : '') +
      '<div class="cart-row total"><span>Total</span><span>₹' + total + '</span></div>';
  },

  async applyCoupon(code) {
    if (!code || !code.trim()) { Toast.error('Enter a coupon code'); return; }
    code = code.trim().toUpperCase();
    // Demo coupons work offline
    const demoCoupons = {
      'WELCOME50': { discount: 50, type: 'flat', desc: '₹50 off on orders above ₹200', min: 200 },
      'FREEDEL':   { discount: 0,  type: 'free_delivery', desc: 'Free delivery', min: 150 },
      'SAVE20':    { discount: 20, type: 'percent', desc: '20% off (max ₹100)', min: 300, max: 100 },
      'WEEKEND25': { discount: 25, type: 'percent', desc: '25% off (max ₹150)', min: 400, max: 150 },
      'FAMILY100': { discount: 100, type: 'flat', desc: '₹100 off on orders above ₹800', min: 800 },
    };
    const sub = Cart.total;
    if (demoCoupons[code]) {
      const c = demoCoupons[code];
      if (sub < c.min) { Toast.error('Min order ₹' + c.min + ' required for ' + code); return; }
      if (c.type === 'flat') this.couponDiscount = c.discount;
      else if (c.type === 'percent') this.couponDiscount = Math.min(Math.round(sub * c.discount / 100), c.max || 9999);
      else if (c.type === 'free_delivery') this.couponDiscount = 0;
      this.appliedCoupon = { code, ...c };
      Toast.success('Coupon "' + code + '" applied! Saving ₹' + this.couponDiscount);
      this.render();
      return;
    }
    try {
      const res = await API.post('/orders/validate-coupon', { code, subtotal: sub });
      this.couponDiscount = res.data.discountAmount;
      this.appliedCoupon = res.data;
      Toast.success('Coupon applied! Saving ₹' + this.couponDiscount);
      this.render();
    } catch(err) { Toast.error(err.message || 'Invalid coupon code'); }
  }
};

/* ─── Theme ──────────────────────────────────────────────────── */
const ThemeManager = {
  init() {
    document.documentElement.setAttribute('data-theme', AppState.theme);
    this.updateIcon();
  },
  toggle() {
    AppState.theme = AppState.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('fe_theme', AppState.theme);
    document.documentElement.setAttribute('data-theme', AppState.theme);
    this.updateIcon();
  },
  updateIcon() {
    document.querySelectorAll('.theme-toggle').forEach(function(btn) {
      btn.textContent = AppState.theme === 'light' ? '🌙' : '☀️';
    });
  }
};

/* ─── Auth ───────────────────────────────────────────────────── */
const Auth = {
  modal: null,
  mode: 'login',
  init() { this.modal = document.getElementById('auth-modal'); },

  open(mode) {
    this.mode = mode || 'login';
    if (this.modal) this.modal.classList.add('open');
    this.render();
  },
  close() {
    if (this.modal) this.modal.classList.remove('open');
  },

  render() {
    const body = document.getElementById('auth-modal-body');
    if (!body) return;
    const m = this.mode;
    if (m === 'login') {
      body.innerHTML = '' +
        '<h2 style="font-family:var(--font-display);font-size:1.6rem;font-weight:800;margin-bottom:6px">Welcome back! 👋</h2>' +
        '<p style="color:var(--text-secondary);margin-bottom:24px;font-size:0.9rem">Login to order your favourite food</p>' +
        '<div class="form-group"><label class="form-label">Email or Phone</label><input type="text" class="form-input" id="auth-identifier" placeholder="Email or 10-digit phone"></div>' +
        '<div class="form-group"><label class="form-label">Password</label><input type="password" class="form-input" id="auth-password" placeholder="Enter password"></div>' +
        '<div style="text-align:right;margin-bottom:16px"><a href="#" onclick="Auth.render(\'otp\')" style="font-size:0.85rem;color:var(--orange)">Forgot Password? / OTP Login</a></div>' +
        '<button class="btn btn-primary w-full" style="justify-content:center" onclick="Auth.login()">Login</button>' +
        '<div class="form-divider" style="display:flex;align-items:center;gap:12px;margin:20px 0;color:var(--text-muted);font-size:0.875rem"><span style="flex:1;height:1px;background:var(--border)"></span>OR<span style="flex:1;height:1px;background:var(--border)"></span></div>' +
        '<button class="google-btn" onclick="Auth.googleLogin()" style="width:100%;padding:12px;background:var(--bg-secondary);border:1.5px solid var(--border);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;gap:10px;font-weight:600;cursor:pointer">🔵 Continue with Google</button>' +
        '<p style="text-align:center;margin-top:20px;font-size:0.875rem;color:var(--text-secondary)">No account? <a href="#" onclick="Auth.render(\'signup\')" style="color:var(--orange);font-weight:600">Sign up free</a></p>';
    } else if (m === 'signup') {
      body.innerHTML = '' +
        '<h2 style="font-family:var(--font-display);font-size:1.6rem;font-weight:800;margin-bottom:6px">Create Account 🎉</h2>' +
        '<p style="color:var(--text-secondary);margin-bottom:24px;font-size:0.9rem">Join thousands of food lovers</p>' +
        '<div class="form-group"><label class="form-label">Full Name *</label><input type="text" class="form-input" id="s-name" placeholder="Your full name"></div>' +
        '<div class="form-group"><label class="form-label">Email *</label><input type="email" class="form-input" id="s-email" placeholder="your@email.com"></div>' +
        '<div class="form-group"><label class="form-label">Phone *</label><input type="tel" class="form-input" id="s-phone" placeholder="10-digit mobile number"></div>' +
        '<div class="form-group"><label class="form-label">Password *</label><input type="password" class="form-input" id="s-pass" placeholder="Min. 6 characters"></div>' +
        '<div class="form-group"><label class="form-label">Referral Code (Optional)</label><input type="text" class="form-input" id="s-ref" placeholder="Friend\'s referral code"></div>' +
        '<button class="btn btn-primary w-full" style="justify-content:center" onclick="Auth.signup()">Create Account</button>' +
        '<p style="text-align:center;margin-top:16px;font-size:0.875rem;color:var(--text-secondary)">Have an account? <a href="#" onclick="Auth.render(\'login\')" style="color:var(--orange);font-weight:600">Login</a></p>';
    } else if (m === 'otp') {
      body.innerHTML = '' +
        '<h2 style="font-family:var(--font-display);font-size:1.6rem;font-weight:800;margin-bottom:6px">OTP Login 📱</h2>' +
        '<p style="color:var(--text-secondary);margin-bottom:24px;font-size:0.9rem">We\'ll send a 6-digit OTP to your phone</p>' +
        '<div class="form-group"><label class="form-label">Phone Number</label>' +
          '<div style="display:flex;gap:8px">' +
            '<input type="tel" class="form-input" id="otp-phone" placeholder="10-digit number" style="flex:1">' +
            '<button class="btn btn-outline btn-sm" onclick="Auth.sendOTP()">Send OTP</button>' +
          '</div></div>' +
        '<div id="otp-step2" style="display:none">' +
          '<div class="form-group"><label class="form-label">Enter OTP</label><input type="text" class="form-input" id="otp-code" placeholder="6-digit OTP" maxlength="6" style="letter-spacing:8px;text-align:center;font-size:1.2rem"></div>' +
          '<button class="btn btn-primary w-full" style="justify-content:center" onclick="Auth.verifyOTP()">Verify & Login</button>' +
        '</div>' +
        '<p style="text-align:center;margin-top:16px;font-size:0.875rem"><a href="#" onclick="Auth.render(\'login\')" style="color:var(--orange)">← Back to Login</a></p>';
    }
  },

  async login() {
    const val  = (document.getElementById('auth-identifier') || {}).value || '';
    const pass = (document.getElementById('auth-password')   || {}).value || '';
    if (!val.trim() || !pass) { Toast.error('Please fill all fields'); return; }
    const btn = document.querySelector('#auth-modal-body .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Logging in...'; }
    try {
      const isPhone = /^\d{10}$/.test(val.trim());
      const payload = isPhone ? { phone: val.trim(), password: pass } : { email: val.trim(), password: pass };
      const res = await API.post('/auth/login', payload);
      AppState.setToken(res.token); AppState.setUser(res.user);
      this.close(); this.updateNavUI();
      Toast.success('Welcome back, ' + res.user.name + '! 🎉');
    } catch(err) {
      Toast.error(err.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Login'; }
    }
  },

  async signup() {
    const name  = (document.getElementById('s-name')  || {}).value || '';
    const email = (document.getElementById('s-email') || {}).value || '';
    const phone = (document.getElementById('s-phone') || {}).value || '';
    const pass  = (document.getElementById('s-pass')  || {}).value || '';
    const ref   = (document.getElementById('s-ref')   || {}).value || '';
    if (!name.trim() || !email.trim() || !phone.trim() || !pass) { Toast.error('Please fill all required fields'); return; }
    if (!/^[6-9]\d{9}$/.test(phone.trim())) { Toast.error('Enter a valid 10-digit Indian phone number'); return; }
    if (pass.length < 6) { Toast.error('Password must be at least 6 characters'); return; }
    const btn = document.querySelector('#auth-modal-body .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }
    try {
      const res = await API.post('/auth/register', { name: name.trim(), email: email.trim(), phone: phone.trim(), password: pass, referralCode: ref.trim() });
      AppState.setToken(res.token); AppState.setUser(res.user);
      this.close(); this.updateNavUI();
      Toast.success('Welcome to Foodie Express, ' + res.user.name + '! 🎉');
    } catch(err) {
      Toast.error(err.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Create Account'; }
    }
  },

  async sendOTP() {
    const phone = (document.getElementById('otp-phone') || {}).value || '';
    if (!/^[6-9]\d{9}$/.test(phone.trim())) { Toast.error('Enter valid 10-digit phone number'); return; }
    try {
      const res = await API.post('/auth/send-otp', { phone: phone.trim() });
      document.getElementById('otp-step2').style.display = 'block';
      Toast.success('OTP sent! Check your phone' + (res.otp ? ' (Dev OTP: ' + res.otp + ')' : ''));
    } catch(err) { Toast.error(err.message); }
  },

  async verifyOTP() {
    const phone = (document.getElementById('otp-phone') || {}).value || '';
    const otp   = (document.getElementById('otp-code')  || {}).value || '';
    if (otp.length !== 6) { Toast.error('Enter 6-digit OTP'); return; }
    try {
      const res = await API.post('/auth/verify-otp', { phone: phone.trim(), otp: otp.trim() });
      AppState.setToken(res.token); AppState.setUser(res.user);
      this.close(); this.updateNavUI();
      Toast.success('Login successful!');
    } catch(err) { Toast.error(err.message); }
  },

  googleLogin() { Toast.info('Google login requires OAuth setup. Configure GOOGLE_CLIENT_ID in backend .env'); },

  logout() {
    AppState.clearAuth();
    Cart.clear();
    this.updateNavUI();
    Toast.info('Logged out successfully');
    if (window.location.pathname.includes('dashboard') || window.location.pathname.includes('checkout')) {
      window.location.href = rootPath('index.html');
    }
  },

  updateNavUI() {
    const loginBtn  = document.getElementById('nav-login-btn');
    const userMenu  = document.getElementById('nav-user-menu');
    const userName  = document.getElementById('nav-user-name');
    if (AppState.user) {
      if (loginBtn) loginBtn.style.display = 'none';
      if (userMenu) { userMenu.style.display = 'flex'; }
      if (userName) userName.textContent = AppState.user.name.split(' ')[0];
    } else {
      if (loginBtn) loginBtn.style.display = 'flex';
      if (userMenu) userMenu.style.display = 'none';
    }
  }
};

/* ─── Restaurant Loader ──────────────────────────────────────── */
const RestaurantLoader = {
  async loadFeatured() {
    const grid = document.getElementById('featured-restaurants');
    if (!grid) return;
    // Show skeletons
    grid.innerHTML = [1,2,3].map(function() {
      return '<div class="restaurant-card" style="pointer-events:none">' +
        '<div class="skeleton" style="height:200px;border-radius:0"></div>' +
        '<div style="padding:16px">' +
          '<div class="skeleton" style="height:20px;width:60%;margin-bottom:8px"></div>' +
          '<div class="skeleton" style="height:14px;margin-bottom:8px"></div>' +
          '<div class="skeleton" style="height:14px;width:40%"></div>' +
        '</div></div>';
    }).join('');
    try {
      const res = await API.get('/restaurants/featured');
      const data = res.data && res.data.length ? res.data : RestaurantLoader.getDemoData();
      grid.innerHTML = data.map(RestaurantLoader.renderCard).join('');
    } catch(e) {
      grid.innerHTML = RestaurantLoader.getDemoData().map(RestaurantLoader.renderCard).join('');
    }
  },

  renderCard(r) {
    const isSaved = AppState.user && AppState.user.savedRestaurants && AppState.user.savedRestaurants.includes(r._id);
    const link = pagesPath('restaurant.html') + '?id=' + (r._id || r.slug || 'demo');
    const banner = r.banner || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600';
    const cuisines = (r.cuisines || []).slice(0, 3).join(' • ');
    const delFee = r.deliveryFee === 0 ? 'Free delivery' : '₹' + r.deliveryFee + ' delivery';
    return '<a class="restaurant-card" href="' + link + '">' +
      '<div class="card-image-wrap">' +
        '<img src="' + banner + '" alt="' + r.name + '" loading="lazy" onerror="this.src=\'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600\'">' +
        (r.isFeatured ? '<span class="card-badge featured">⭐ Featured</span>' : '') +
        (r.offers && r.offers[0] ? '<span class="card-badge offer">' + r.offers[0].title + '</span>' : '') +
        '<button class="card-save-btn' + (isSaved ? ' saved' : '') + '" onclick="event.preventDefault();toggleSave(\'' + r._id + '\',this)" title="Save">' + (isSaved ? '❤️' : '🤍') + '</button>' +
      '</div>' +
      '<div class="card-body">' +
        '<div class="card-header"><div class="card-name">' + r.name + '</div><div class="card-rating">⭐ ' + (r.rating || '4.0') + '</div></div>' +
        '<div class="card-cuisines">' + cuisines + '</div>' +
        '<div class="card-meta">' +
          '<span>🕐 ' + (r.deliveryTime || 30) + ' min</span>' +
          '<span>🚚 ' + delFee + '</span>' +
          '<span class="veg-badge ' + (r.isPureVeg ? 'veg' : 'nonveg') + '">' + (r.isPureVeg ? '🟢 Veg' : '🔴 Non-Veg') + '</span>' +
        '</div>' +
      '</div>' +
    '</a>';
  },

  getDemoData() {
    return [
      { _id: 'demo1', name: 'The Burger Palace', rating: 4.5, cuisines: ['American','Burgers','Fast Food'], deliveryTime: 25, deliveryFee: 30, isFeatured: true, isPureVeg: false, banner: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600', offers: [{title:'20% OFF'}] },
      { _id: 'demo2', name: 'Pizza Paradise',    rating: 4.3, cuisines: ['Italian','Pizza'],                deliveryTime: 35, deliveryFee: 40, isFeatured: true, isPureVeg: true,  banner: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600' },
      { _id: 'demo3', name: 'Spice Garden',      rating: 4.7, cuisines: ['North Indian','Biryani'],        deliveryTime: 40, deliveryFee: 25, isFeatured: true, isPureVeg: false, banner: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600' },
    ];
  }
};

/* ─── Location ───────────────────────────────────────────────── */
const LocationManager = {
  async detect() {
    return new Promise(function(resolve) {
      if (!navigator.geolocation) { resolve('Lucknow'); return; }
      navigator.geolocation.getCurrentPosition(
        async function(pos) {
          try {
            const r = await fetch('https://nominatim.openstreetmap.org/reverse?lat=' + pos.coords.latitude + '&lon=' + pos.coords.longitude + '&format=json');
            const d = await r.json();
            resolve(d.address && (d.address.city || d.address.town || d.address.state_district) || 'Your Location');
          } catch(e) { resolve('Your Location'); }
        },
        function() { resolve('Lucknow'); }
      );
    });
  },
  async updateUI() {
    const els = document.querySelectorAll('.location-text');
    if (!els.length) return;
    const city = await this.detect();
    els.forEach(function(el) { el.textContent = city; });
    localStorage.setItem('fe_location', city);
  }
};

/* ─── Typing Animation ───────────────────────────────────────── */
const TypingAnimation = {
  words: ['Burgers 🍔', 'Pizza 🍕', 'Biryani 🍛', 'Sushi 🍣', 'Tacos 🌮', 'Desserts 🍰'],
  current: 0, el: null,
  init() {
    this.el = document.querySelector('.typing-text');
    if (this.el) this.type();
  },
  type() {
    const word = this.words[this.current];
    let i = 0; this.el.textContent = '';
    const self = this;
    const t = setInterval(function() {
      if (i < word.length) { self.el.textContent += word[i++]; }
      else { clearInterval(t); setTimeout(function() { self.erase(word); }, 2000); }
    }, 80);
  },
  erase(word) {
    let i = word.length;
    const self = this;
    const t = setInterval(function() {
      if (i > 0) { self.el.textContent = word.substring(0, --i); }
      else { clearInterval(t); self.current = (self.current + 1) % self.words.length; setTimeout(function() { self.type(); }, 300); }
    }, 50);
  }
};

/* ─── Voice Search ───────────────────────────────────────────── */
const VoiceSearch = {
  recognition: null, isListening: false,
  init() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    this.recognition = new SR();
    this.recognition.lang = 'en-IN';
    const self = this;
    this.recognition.onresult = function(e) {
      const q = e.results[0][0].transcript;
      const inp = document.querySelector('.hero-search input') || document.querySelector('.search-input');
      if (inp) { inp.value = q; inp.dispatchEvent(new Event('input')); }
      Toast.success('Searching: "' + q + '"');
    };
    this.recognition.onend = function() { self.isListening = false; self.updateBtn(); };
    this.recognition.onerror = function() { Toast.error('Voice search failed'); self.isListening = false; self.updateBtn(); };
  },
  toggle() {
    if (!this.recognition) { Toast.error('Voice search not supported in this browser'); return; }
    if (this.isListening) { this.recognition.stop(); }
    else { this.recognition.start(); this.isListening = true; Toast.info('Listening... 🎤'); }
    this.updateBtn();
  },
  updateBtn() {
    const btn = document.getElementById('voice-search-btn');
    if (btn) btn.textContent = this.isListening ? '⏹️' : '🎤';
  }
};

/* ─── Stats Counter ──────────────────────────────────────────── */
function animateStats() {
  const els = document.querySelectorAll('.stat-number');
  if (!els.length) return;
  const obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.target || el.textContent) || 0;
      const suffix = el.dataset.suffix || '';
      let cur = 0;
      const step = target / 80;
      const timer = setInterval(function() {
        cur = Math.min(cur + step, target);
        el.textContent = Math.floor(cur).toLocaleString() + suffix;
        if (cur >= target) clearInterval(timer);
      }, 16);
      obs.unobserve(el);
    });
  });
  els.forEach(function(el) { obs.observe(el); });
}

/* ─── Loader ─────────────────────────────────────────────────── */
function hideLoader() {
  const loader = document.getElementById('loader');
  if (!loader) return;
  setTimeout(function() {
    loader.style.opacity = '0';
    loader.style.transition = 'opacity 0.5s ease';
    setTimeout(function() { if (loader.parentNode) loader.parentNode.removeChild(loader); }, 500);
  }, 800);
}

/* ─── Navbar scroll ──────────────────────────────────────────── */
function initNavScroll() {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  window.addEventListener('scroll', function() {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

/* ─── Mobile Menu ────────────────────────────────────────────── */
function initMobileMenu() {
  const btn  = document.querySelector('.hamburger');
  const menu = document.querySelector('.mobile-menu');
  if (!btn || !menu) return;
  btn.addEventListener('click', function() {
    const open = menu.classList.toggle('open');
    const spans = btn.querySelectorAll('span');
    spans[0].style.transform = open ? 'rotate(45deg) translate(5px, 5px)' : '';
    spans[1].style.opacity   = open ? '0' : '1';
    spans[2].style.transform = open ? 'rotate(-45deg) translate(5px, -5px)' : '';
  });
  // Close on link click
  menu.querySelectorAll('a').forEach(function(a) {
    a.addEventListener('click', function() { menu.classList.remove('open'); });
  });
}

/* ─── AOS ────────────────────────────────────────────────────── */
function initAOS() {
  if (typeof AOS !== 'undefined') AOS.init({ duration: 700, easing: 'ease-out-cubic', once: true, offset: 60 });
}

/* ─── GSAP ───────────────────────────────────────────────────── */
function initGSAP() {
  if (typeof gsap === 'undefined') return;
  gsap.from('.hero-eyebrow',    { y: 30, opacity: 0, duration: 0.6, delay: 0.2 });
  gsap.from('.hero-title',      { y: 40, opacity: 0, duration: 0.7, delay: 0.4 });
  gsap.from('.hero-description',{ y: 30, opacity: 0, duration: 0.6, delay: 0.6 });
  gsap.from('.hero-search',     { y: 30, opacity: 0, duration: 0.6, delay: 0.7 });
  gsap.from('.hero-stats',      { y: 20, opacity: 0, duration: 0.5, delay: 0.9 });
}

/* ─── Newsletter ─────────────────────────────────────────────── */
function initNewsletter() {
  const form = document.getElementById('newsletter-form');
  if (!form) return;
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const email = form.querySelector('input[type="email"]');
    if (!email || !email.value) return;
    Toast.success('Subscribed! 🎉 Watch for exclusive deals.');
    form.reset();
  });
}

/* ─── Toggle Save Restaurant ─────────────────────────────────── */
async function toggleSave(restaurantId, btn) {
  if (!AppState.user) { Auth.open('login'); return; }
  try {
    const res = await API.post('/users/save-restaurant/' + restaurantId);
    btn.innerHTML  = res.saved ? '❤️' : '🤍';
    btn.classList.toggle('saved', res.saved);
    Toast.success(res.saved ? 'Restaurant saved!' : 'Restaurant removed from saved');
  } catch(err) {
    // Optimistic toggle when offline
    const saved = btn.classList.toggle('saved');
    btn.innerHTML = saved ? '❤️' : '🤍';
    Toast.info(saved ? 'Restaurant saved!' : 'Removed from saved');
  }
}

/* ─── MAIN INIT ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {

  /* Core */
  ThemeManager.init();
  Toast.init();
  Auth.init();
  Auth.updateNavUI();
  Cart.items = AppState.cart;
  Cart.updateUI();

  /* Nav & layout */
  initNavScroll();
  initMobileMenu();
  initAOS();
  initNewsletter();
  animateStats();
  hideLoader();
  VoiceSearch.init();

  /* Theme toggle — works on all pages */
  document.querySelectorAll('.theme-toggle').forEach(function(btn) {
    btn.addEventListener('click', function() { ThemeManager.toggle(); });
  });

  /* Cart sidebar */
  var cartBtn = document.querySelector('.cart-btn');
  if (cartBtn) cartBtn.addEventListener('click', function() { CartSidebar.open(); });

  var cartOverlay = document.getElementById('cart-overlay');
  if (cartOverlay) cartOverlay.addEventListener('click', function() { CartSidebar.close(); });

  document.querySelectorAll('.cart-close').forEach(function(btn) {
    btn.addEventListener('click', function() { CartSidebar.close(); });
  });

  /* Auth */
  var navLoginBtn = document.getElementById('nav-login-btn');
  if (navLoginBtn) navLoginBtn.addEventListener('click', function() { Auth.open('login'); });

  document.querySelectorAll('.modal-close').forEach(function(btn) {
    btn.addEventListener('click', function() { Auth.close(); });
  });

  var authModal = document.getElementById('auth-modal');
  if (authModal) authModal.addEventListener('click', function(e) {
    if (e.target === authModal) Auth.close();
  });

  var navLogout = document.getElementById('nav-logout');
  if (navLogout) navLogout.addEventListener('click', function() { Auth.logout(); });

  /* Coupon */
  var applyCouponBtn = document.getElementById('apply-coupon-btn');
  if (applyCouponBtn) applyCouponBtn.addEventListener('click', function() {
    var inp = document.querySelector('.coupon-input');
    if (inp) CartSidebar.applyCoupon(inp.value);
  });

  var couponInput = document.querySelector('.coupon-input');
  if (couponInput) couponInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') CartSidebar.applyCoupon(e.target.value);
  });

  /* Checkout button (in cart sidebar) */
  var checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) checkoutBtn.addEventListener('click', function() {
    if (Cart.items.length === 0) { Toast.error('Your cart is empty!'); return; }
    if (!AppState.user) { Auth.open('login'); return; }
    window.location.href = pagesPath('checkout.html');
  });

  /* Voice search */
  var voiceBtn = document.getElementById('voice-search-btn');
  if (voiceBtn) voiceBtn.addEventListener('click', function() { VoiceSearch.toggle(); });

  /* Hero search */
  var heroInput = document.querySelector('.hero-search input');
  var heroBtn   = document.querySelector('.hero-search .btn-primary, .hero-search .btn[type="button"]');
  if (!heroBtn) heroBtn = document.querySelector('.hero-search button:not(#voice-search-btn)');
  if (heroBtn && heroInput) {
    heroBtn.addEventListener('click', function() {
      var q = heroInput.value.trim();
      if (q) window.location.href = rootPath('restaurants.html') + '?search=' + encodeURIComponent(q);
    });
    heroInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') heroBtn.click(); });
  }

  /* Location */
  document.querySelectorAll('.nav-location').forEach(function(btn) {
    btn.addEventListener('click', function() { LocationManager.updateUI(); });
  });

  /* Category cards */
  document.querySelectorAll('.category-card').forEach(function(card) {
    card.addEventListener('click', function() {
      var cat = card.dataset.category;
      if (cat && cat !== 'all') {
        window.location.href = rootPath('restaurants.html') + '?cuisine=' + encodeURIComponent(cat);
      } else if (cat === 'all') {
        window.location.href = rootPath('restaurants.html');
      }
      document.querySelectorAll('.category-card').forEach(function(c) { c.classList.remove('active'); });
      card.classList.add('active');
    });
  });

  /* Home page specific */
  if (document.getElementById('hero')) {
    TypingAnimation.init();
    RestaurantLoader.loadFeatured();
    LocationManager.updateUI();
    initGSAP();
  }
});

/* ─── Globals ────────────────────────────────────────────────── */
window.Cart            = Cart;
window.CartSidebar     = CartSidebar;
window.Auth            = Auth;
window.Toast           = Toast;
window.API             = API;
window.AppState        = AppState;
window.RestaurantLoader= RestaurantLoader;
window.LocationManager = LocationManager;
window.toggleSave      = toggleSave;
window.rootPath        = rootPath;
window.pagesPath       = pagesPath;
