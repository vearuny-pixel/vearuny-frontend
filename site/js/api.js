/* Public checkout only. No credentials or protected endpoints. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CheckoutAPI = api;
})(globalThis, function() {
  'use strict';
  const BASE = 'https://api.vearuny.com';
  const STORAGE_KEY = 'vearuny.checkout.v1';
  const CATALOG_CACHE_KEY = 'vearuny.catalog.v1';
  const CATALOG_CACHE_TTL = 5 * 60 * 1000;
  class APIError extends Error {
    constructor(message, status = 0) { super(message); this.status = status; }
  }
  function createClient({fetchImpl = globalThis.fetch.bind(globalThis), storage, catalogStorage = storage, uuid = () => globalThis.crypto.randomUUID(), timeout = 25000} = {}) {
    let attempt = null, pending = false, catalogRequest = null;
    // Fail closed if storage is corrupt/unavailable. Never silently lose a retry identity.
    if (storage) { const saved = storage.getItem(STORAGE_KEY); if (saved) attempt = JSON.parse(saved); }
    const save = () => { if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(attempt)); };
    async function request(path, body, key) {
      const allowed = body ? ['/api/customers','/api/orders','/api/checkout/quote'] : ['/api/plans','/api/packages','/api/addons'];
      if (!allowed.includes(path)) throw new APIError('Unsupported public checkout route');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetchImpl(BASE + path, {method: body ? 'POST' : 'GET', credentials: 'omit', cache: 'no-store',
          headers: {...(body ? {'Content-Type':'application/json'} : {}), ...(key ? {'Idempotency-Key':key} : {})},
          ...(body ? {body:JSON.stringify(body)} : {}), signal:controller.signal});
        let data;
        try { data = await res.json(); } catch { throw new APIError('Unreadable API response; retry the same order.', res.ok ? 0 : res.status); }
        if (!res.ok || data.status !== 'OK') throw new APIError(data.message || 'API unavailable', res.status);
        return {data, replayed:res.headers.get('Idempotency-Replayed') === 'true'};
      } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(error.name === 'AbortError' ? 'Network timeout; order status uncertain.' : 'Network failure; order status uncertain.');
      } finally { clearTimeout(timer); }
    }
    return {
      get attempt() { return attempt; }, get pending() { return pending; }, request,
      async catalog() {
        const valid = value => value && ['plans','packages','addons'].every(k=>Array.isArray(value[k])) &&
          ['X2-EGG','X2-MEAT','X2-CHICKEN','X2-SEAFOOD'].every(code=>value.addons.some(a=>a.code===code && Array.isArray(a.pricing_rules)));
        const fresh = at => Number.isFinite(at) && Date.now() >= at && Date.now()-at < CATALOG_CACHE_TTL;
        if (valid(this._catalogCache) && fresh(this._catalogCacheAt)) return this._catalogCache;
        if (catalogRequest) return catalogRequest;
        try {
          const saved = JSON.parse(catalogStorage?.getItem(CATALOG_CACHE_KEY) || 'null');
          if (saved && fresh(saved.savedAt) && valid(saved.catalog)) {
            this._catalogCache=saved.catalog; this._catalogCacheAt=saved.savedAt; return saved.catalog;
          }
        } catch (_) { /* Optional cache never prevents checkout. */ }
        catalogRequest = (async()=>{
          const results=await Promise.all(['/api/plans','/api/packages','/api/addons'].map(p=>request(p)));
          const catalog={plans:results[0].data.plans,packages:results[1].data.packages,addons:results[2].data.addons};
          if (!valid(catalog)) throw new APIError('Confirmed add-on catalog unavailable');
          this._catalogCache=catalog; this._catalogCacheAt=Date.now();
          try { catalogStorage?.setItem(CATALOG_CACHE_KEY,JSON.stringify({savedAt:this._catalogCacheAt,catalog})); } catch (_) {}
          return catalog;
        })();
        try { return await catalogRequest; } finally { catalogRequest=null; }
      },
      async quote(order) {
        const result = await request('/api/checkout/quote', order);
        validateQuote(result.data);
        return result.data.quote;
      },
      reset() {
        if (pending || (attempt && !attempt.receipt && !attempt.rejected)) throw new APIError('Retry the existing order before starting another.');
        if (storage) storage.removeItem(STORAGE_KEY);
        attempt = null;
      },
      async checkout(customer, order) {
        if (pending) throw new APIError('Submission already pending');
        pending = true;
        try {
          if (!attempt) {
            attempt = JSON.parse(JSON.stringify({key:uuid(), customer, order}));
            save(); // Persist before any POST. A failed write means no request is sent.
          }
          if (attempt.receipt) return attempt.receipt;
          if (attempt.rejected) throw new APIError('Correct the rejected order before submitting again.');
          save();
          if (!attempt.order.customer_id) {
            const {data} = await request('/api/customers', attempt.customer);
            if (!Number.isInteger(data.customer?.id)) throw new APIError('Invalid customer response');
            attempt.order.customer_id = data.customer.id;
            save();
          }
          const result = await request('/api/orders', attempt.order, attempt.key);
          validateReceipt(result.data);
          attempt.receipt = {...result.data, replayed:result.replayed};
          save();
          return attempt.receipt;
        } catch(error) {
          // Explicit validation rejection is safe to correct. 409 and ambiguous errors retain the exact payload/key.
          if (attempt && [400,404,413,415,422].includes(error.status)) { attempt.rejected = true; save(); }
          throw error;
        } finally { pending = false; }
      }
    };
  }
  function packageFor(catalog, plan, code) {
    const pkg = catalog.packages.find(p => p.plan_code === plan.toUpperCase() && p.package_code === code && p.status === 'active');
    if (!pkg || !/^\d+(\.\d{1,2})?$/.test(String(pkg.price)) || Number(pkg.price) <= 0) throw new APIError('Unavailable package: ' + plan + ' ' + code, 400);
    return pkg;
  }
  function buildPayload(catalog, form, sets, language, {quote = false} = {}) {
    const plan = catalog.plans.find(p => p.code === form.plan_type.toUpperCase() && p.status === 'active');
    if (!plan) throw new APIError('Unavailable meal plan',400);
    if (!Number.isInteger(Number(form.quantity)) || Number(form.quantity)<1 || Number(form.quantity)>100 || sets.length !== Number(form.quantity)) throw new APIError('Quantity must be 1–100',400);
    const items = sets.map(set => {
      const pkg = packageFor(catalog, form.plan_type, set.code);
      const menu_focus = 'ABC'.includes(set.code) ? 'weight_loss' : 'muscle';
      const juice_option = ['none','small','large']['ABCDEF'.indexOf(set.code)%3];
      const addons = set.addons.map(id => {
        const addon = catalog.addons.find(a => a.id === Number(id));
        if (!addon?.pricing_rules.some(r => r.meal_plan_id === plan.id && r.package_group === (menu_focus === 'muscle' ? 'D-F' : 'A-C'))) throw new APIError('Invalid or unavailable add-on',400);
        return {id:addon.id};
      });
      return {package_id:pkg.id, quantity:1, menu_focus, juice_option, addons};
    });
    // Identical sets share an order item; mixed sets keep their own add-ons.
    const grouped = [];
    for (const item of items) {
      const match = grouped.find(i => i.package_id === item.package_id && JSON.stringify(i.addons) === JSON.stringify(item.addons));
      if (match) match.quantity++; else grouped.push(item);
    }
    const delivery = form.method === 'delivery';
    if (!quote && delivery && ['district','commune','address'].some(k => !form[k]?.trim())) throw new APIError('Delivery requires district, commune and address',400);
    const customer = {name:(form.customer_name || '').trim(), phone:(form.phone || '').trim(), branch_id:plan.branch_id, language:language === 'kh' ? 'KH' : 'EN', source:'web', nutrition_notes:form.nutrition_notes || null};
    const order = {meal_plan_id:plan.id, items:grouped, fulfillment_method:form.method,
      district:delivery ? form.district : null, commune:delivery ? form.commune : null, address:delivery ? form.address : null,
      fulfillment_time:delivery ? form.time_slot : form.pickup_time, start_date:form.start_date,
      menu_focus:items[0].menu_focus, juice_option:items[0].juice_option,
      subscriber_type:form.subscriber_type || 'none', previous_subscription_number:form.subscriber_type==='old' ? form.subscription_number || null : null,
      customer_remarks:form.remark || null, nutrition_notes:form.nutrition_notes || null, source:'web'};
    if (new TextEncoder().encode(JSON.stringify({...order,customer_id:2147483647})).length > 32000) throw new APIError('Order details are too long; shorten remarks or nutrition notes.',400);
    return {customer, order};
  }
  function validateReceipt(data) {
    const o = data.order;
    if (!o?.order_code || !Array.isArray(data.items) || !data.customer || !data.plan ||
        ['base_amount','discount_amount','addon_total','delivery_fee','total_amount'].some(k => !/^\d+(\.\d{1,2})?$/.test(String(o[k])))) throw new APIError('Incomplete receipt; retry the same order.');
  }
  function validateQuote(data) {
    const q=data.quote;
    if (!q || !Array.isArray(q.items) || ['base_amount','discount_amount','addon_total','delivery_fee','total_amount'].some(k => !/^\d+(\.\d{1,2})?$/.test(String(q[k])))) throw new APIError('Incomplete price response.');
  }
  const labels = {
    en:{code:'Order code',base:'Base amount',discount:'Discount',addons:'Add-ons',delivery:'Delivery fee',total:'Total',method:'Delivery / pickup',time:'Time',start:'Start date',name:'Name',phone:'Phone',address:'Address',notes:'Nutrition notes',remarks:'Remarks',subscriber:'Subscriber',previous:'Previous subscription',payment:'Payment status',pickup:'Pickup',deliveryMethod:'Delivery',pending:'Order Summary',create:'Create order',retry:'Retry same order',loading:'Submitting…',catalog:'Loading menu…',newOrder:'Start New Order',created:'Order created. Payment is not confirmed.',error:'Unable to complete checkout.',recovery:'Your saved order is ready to retry.',rules:'Discount rules',nutrition:'Nutrition notes (optional)'},
    kh:{code:'លេខកូដកម្ម៉ង់',base:'តម្លៃដើម',discount:'ការបញ្ចុះតម្លៃ',addons:'បន្ថែមមុខម្ហូប',delivery:'ថ្លៃដឹកជញ្ជូន',total:'សរុប',method:'ការទទួល',time:'ម៉ោង',start:'ថ្ងៃចាប់ផ្តើម',name:'ឈ្មោះ',phone:'ទូរស័ព្ទ',address:'អាសយដ្ឋាន',notes:'ចំណាំអាហារូបត្ថម្ភ',remarks:'ចំណាំ',subscriber:'ប្រភេទអតិថិជន',previous:'លេខជាវពីមុន',payment:'ស្ថានភាពការទូទាត់',pickup:'មកយក',deliveryMethod:'ដឹកជញ្ជូន',pending:'តម្លៃសរុបរបស់អ្នក',create:'បង្កើតកម្ម៉ង់',retry:'សាកល្បងកម្ម៉ង់ដដែលម្ដងទៀត',loading:'កំពុងបញ្ជូន…',catalog:'កំពុងទាញយកម៉ឺនុយ…',newOrder:'កម្ម៉ង់ថ្មី',created:'បានបង្កើតកម្ម៉ង់។ មិនទាន់បញ្ជាក់ការទូទាត់។',error:'មិនអាចបញ្ចប់កម្ម៉ង់បាន។',recovery:'កម្ម៉ង់ដែលបានរក្សាទុកអាចសាកល្បងម្ដងទៀត។',rules:'លក្ខខណ្ឌបញ្ចុះតម្លៃ',nutrition:'ចំណាំអាហារូបត្ថម្ភ (មិនតម្រូវ)'}
  };
  function receiptLines(receipt, language = 'en') {
    if (!receipt) return [];
    const t = labels[language], o = receipt.order;
    const currency = o.currency || 'USD';
    const amount = n => `${n} ${currency}`;
    const rules = {friday:language==='kh'?'ថ្ងៃសុក្រ':'Friday',new_subscriber:language==='kh'?'អតិថិជនថ្មី':'New subscriber',returning_subscriber:language==='kh'?'អតិថិជនចាស់':'Returning subscriber',none:'—'};
    const friendlyDate=value => {
      const match=String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/); if(!match) return value;
      const [,year,month,day]=match; const khMonths=['មករា','កុម្ភៈ','មីនា','មេសា','ឧសភា','មិថុនា','កក្កដា','សីហា','កញ្ញា','តុលា','វិច្ឆិកា','ធ្នូ'];
      const date=language==='kh' ? `${day} ${khMonths[Number(month)-1]} ${year}` : `${day} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(month)-1]} ${year}`;
      return date;
    };
    return [[t.code,o.order_code],['Vearuny',receipt.plan.code],
      ...receipt.items.flatMap(i => [[`${i.package_code} × ${i.quantity}`,amount(i.base_amount)], ...(i.addons || []).map(a => [a.name,amount(a.total_amount)])]),
      [t.base,amount(o.base_amount)],[t.discount,amount(o.discount_amount)],[t.rules,`${rules[o.discount_rule] || o.discount_rule} (${o.discount_percentage}%)`],
      [t.addons,amount(o.addon_total)],[t.delivery,amount(o.delivery_fee)],[t.total,amount(o.total_amount)],
      [t.name,receipt.customer.name],[t.phone,receipt.customer.phone],[t.method,o.fulfillment_method === 'pickup'?t.pickup:t.deliveryMethod],
      [t.address,o.fulfillment_method === 'pickup' ? 'Vearuny Kitchen' : [o.district,o.commune,o.address].filter(Boolean).join(', ')],
      [t.time,friendlyDate(o.fulfillment_time)],[t.start,friendlyDate(o.start_date)],[t.subscriber,({new:language==='kh'?'អតិថិជនថ្មី':'New subscriber',old:language==='kh'?'អតិថិជនចាស់':'Returning subscriber',none:'—'})[o.subscriber_type] || '—'],[t.previous,o.previous_subscription_number],
      [t.remarks,o.customer_remarks],[t.notes,o.nutrition_notes],[t.payment,o.payment_status==='unpaid'?(language==='kh'?'មិនទាន់បង់ប្រាក់':'Pending Payment'):o.payment_status]].filter(([,v]) => v != null && v !== '');
  }
  return {createClient, buildPayload, packageFor, receiptLines, labels, APIError, STORAGE_KEY, validateQuote};
});
