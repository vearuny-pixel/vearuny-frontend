// --- CONSTANTS ---
        const PICKUP_LOCATION_LINK = "https://maps.app.goo.gl/XePtBJKT8hGEPaiw6";
        const ADMIN_USERNAME = "vearuny"; // Admin username for t.me link
        const PAYWAY_USD_LINK = "https://link.payway.com.kh/Ji386167m";
        const PAYWAY_KHR_LINK = "https://link.payway.com.kh/ra386168n";

        // Global variables to store QR code data URLs
        let qrCodeUsdDataUrl = null;
        let qrCodeKhrDataUrl = null;

        // **Actual Logo URL**
        const logoDataUrl = 'graylogo.png';

        // DATA and translations variables are now loaded from external files (lang-en.js and lang-kh.js)
        const DATA = window.DATA || {};
        const translations = window.translations || {};

        // Catalog and final amounts are exclusively supplied by the public API.
        let catalog = null;
        let checkoutClient = null;
        let catalogLoading = false;
        const apiText = () => CheckoutAPI.labels[currentLanguage];
        const receipt = () => checkoutClient?.attempt?.receipt;
        const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

        const PACKAGE_NAMES = {
            en: {A:'Everyday Salad — Meal Only',B:'Everyday Salad + Small Juice',C:'Everyday Salad + Large Juice',D:'High-Protein Salad — Meal Only',E:'High-Protein Salad + Small Juice',F:'High-Protein Salad + Large Juice'},
            kh: {A:'សាឡាដប្រចាំថ្ងៃ — មិនមានទឹកផ្លែឈើ',B:'សាឡាដប្រចាំថ្ងៃ + ទឹកផ្លែឈើតូច',C:'សាឡាដប្រចាំថ្ងៃ + ទឹកផ្លែឈើធំ',D:'សាឡាដប្រូតេអ៊ីនខ្ពស់ — មិនមានទឹកផ្លែឈើ',E:'សាឡាដប្រូតេអ៊ីនខ្ពស់ + ទឹកផ្លែឈើដបតូច',F:'សាឡាដប្រូតេអ៊ីនខ្ពស់ + ទឹកផ្លែឈើដបធំ'}
        };

        // Menu Focus (1st pre-selection group) and Juice Option (2nd pre-selection group).
        // Together they determine exactly one of the original 6 packages (A-F), computed via FOCUS_JUICE_TO_PACKAGE.
        const MENU_FOCUS_NAMES = {
            en: { weight_loss: 'Weight Focus (Salad)', muscle: 'Muscle Focus (Mix Noodle & Rice)' },
            kh: { weight_loss: 'ឈុតសម្រកទម្ងន់ (សាលាដសុទ្ធ)', muscle: 'ឈុតថែរក្សាសាច់ដុំ (មានមី និងបាយ)' }
        };
        const JUICE_OPTION_NAMES = {
            en: { none: 'No Juice', small: 'Small Juice​ 200ml', large: 'Large Juice 350ml' },
            kh: { none: 'មិនមានទឹកផ្លែឈើ', small: 'ទឹកផ្លែឈើដបតូច 200ml', large: 'ទឹកផ្លែឈើដបធំ 350ml' }
        };
        const FOCUS_JUICE_LABELS = {
            en: { focus: 'Choose Your Focus', juice: 'Choose Your Juice' },
            kh: { focus: 'ជ្រើសរើសគោលដៅរបស់អ្នក', juice: 'ជ្រើសរើសទឹកផ្លែឈើ' }
        };
        const FOCUS_JUICE_TO_PACKAGE = {
            weight_loss: { none: 'A', small: 'B', large: 'C' },
            muscle: { none: 'D', small: 'E', large: 'F' }
        };
        const PACKAGE_TO_FOCUS_JUICE = {
            A: ['weight_loss', 'none'], B: ['weight_loss', 'small'], C: ['weight_loss', 'large'],
            D: ['muscle', 'none'], E: ['muscle', 'small'], F: ['muscle', 'large']
        };
        const FOCUS_PACKAGE_GROUPS = { weight_loss: ['A', 'B', 'C'], muscle: ['D', 'E', 'F'] };
        const ADD_ON_NAMES = {'X2-EGG':{en:'🥚 x2 Egg',kh:'🥚 ពងមាន់ x2'},'X2-MEAT':{en:'🥩 x2 Meat',kh:'🥩 សាច់ x2'},'X2-CHICKEN':{en:'🍗 x2 Chicken',kh:'🍗 សាច់មាន់ x2'},'X2-SEAFOOD':{en:'🦐 x2 Seafood',kh:'🦐 គ្រឿងសមុទ្រ x2'}};
        const selectedAddons = new Map();

        const REMARK_OPTIONS = [
            {value:'double_sauce',en:'Double Sauce',kh:'ទឹកជ្រលក់x2'},
            {value:'no_cutlery',en:'No Cutlery',kh:'មិនយកស្លាបព្រាសម'},
            {value:'no_seafood',en:'No Seafood',kh:'មិនយកគ្រឿងសមុទ្រ'},
            {value:'no_beef',en:'No Beef',kh:'មិនយកសាច់គោ'}
        ];

        const FRIENDLY_TEXT = {
            en:{weekly:'Weekly — 5 Meals',monthly:'Monthly — 20 Meals',newCustomer:'New Customer',returning:'Returning Customer',tomorrow:'Tomorrow',dayAfter:'Day After Tomorrow',monday:'Monday',districtOptional:'District *',districtPlaceholder:'Select district',remarkTitle:'7. Remark (Optional)',addonTitle:'8. Additional Add-ons (Optional)',subscriberTitle:'9. Subscriber Type',addonNote:'Chicken and seafood are charged only on the menu days containing them.',ticketInstructions:'Review your ticket below. You can send it directly to order via Telegram, copy the order information, or simply screenshot it to share.',copy:'Copy Summary',telegram:'Send to Telegram',flipQr:'Show QR Side',flipDetails:'Show Details Side',downloadQr:'Download Ticket with QR',qrTitle:'SCAN ORDER QR',qrHelp:'Screenshot or send this QR to Vearuny Kitchen.',perDay:''},
            kh:{weekly:'ប្រចាំសប្ដាហ៍ — ៥ ពេល',monthly:'ប្រចាំខែ — ២០ ពេល',newCustomer:'អតិថិជនថ្មី',returning:'អតិថិជនចាស់',tomorrow:'ថ្ងៃស្អែក',dayAfter:'ខានស្អែក',monday:'ថ្ងៃច័ន្ទ',districtOptional:'ខណ្ឌ',districtPlaceholder:'ជ្រើសរើសខណ្ឌ',remarkTitle:'៧. ចំណាំ',addonTitle:'៨. បន្ថែមមុខម្ហូប',subscriberTitle:'៩. ប្រភេទអតិថិជន',addonNote:'សាច់មាន់ និងគ្រឿងសមុទ្រ គិតថ្លៃតែតាមចំនួនថ្ងៃដែលមានក្នុងម៉ឺនុយប៉ុណ្ណោះ។',ticketInstructions:'សូមពិនិត្យសំបុត្រកម្ម៉ង់ខាងក្រោម។ អ្នកអាចផ្ញើការកម្ម៉ង់តាមតេលេក្រាម ចម្លងព័ត៌មានកម្ម៉ង់ ឬថតអេក្រង់ដើម្បីចែករំលែក។',copy:'ចម្លងសេចក្ដីសង្ខេប',telegram:'ផ្ញើទៅតេលេក្រាម',flipQr:'បង្ហាញផ្នែក QR',flipDetails:'បង្ហាញព័ត៌មានកម្ម៉ង់',downloadQr:'ទាញយកសំបុត្រជាមួយ QR',qrTitle:'ស្កេន QR ការកម្ម៉ង់',qrHelp:'ថតអេក្រង់ ឬផ្ញើ QR នេះទៅផ្ទះបាយវារុណី។',perDay:''}
        };

        const getOrderedPackages = quantity => {
            const main = document.getElementById('package')?.value || 'A';
            const different = document.getElementById('diff_packages_check')?.checked && quantity > 1;
            return different ? [main, ...[...document.querySelectorAll('.additional-pkg-select')].map(s=>s.value)] : Array(quantity).fill(main);
        };
        const renderAddons = () => {
            const box = document.getElementById('addon-options');
            box.replaceChildren();
            if (!catalog) return;
            const quantity = Number(document.getElementById('quantity').value);
            if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return;
            const codes = getOrderedPackages(quantity);
            for (const key of selectedAddons.keys()) if (key >= codes.length) selectedAddons.delete(key);
            const plan = document.getElementById('plan_type').value.toUpperCase();
            codes.forEach((code,index) => {
                const fieldset = document.createElement('fieldset'); fieldset.className = 'p-3 rounded-xl border-2 space-y-2';
                const legend = document.createElement('legend'); legend.textContent = `${currentLanguage==='kh'?'ឈុត':'Set'} ${index+1} · ${code}`; fieldset.append(legend);
                const selected = selectedAddons.get(index) || new Set(); selectedAddons.set(index,selected);
                catalog.addons.filter(a => ADD_ON_NAMES[a.code]).forEach(addon => {
                    const rule = addon.pricing_rules.find(r => r.plan_code===plan && r.package_group===('ABC'.includes(code)?'A-C':'D-F'));
                    if (!rule) { selected.delete(addon.id); return; }
                    const label = document.createElement('label'); label.className = 'flex items-center gap-2 text-sm';
                    const input = document.createElement('input'); input.type='checkbox'; input.className='addon-checkbox'; input.checked=selected.has(addon.id);
                    input.dataset.item=String(index); input.value=addon.id;
                    input.onchange=()=>{if(input.checked)selected.add(addon.id);else selected.delete(addon.id);updatePriceSummary();};
                    const text = document.createElement('span');
                    // Display API rule operands only; the API computes all effective charges.
                    text.textContent = `${ADD_ON_NAMES[addon.code][currentLanguage]} · $${rule.price_per_meal}/${currentLanguage==='kh'?'ពេល':'meal'} · ${rule.applicable_meal_count} ${currentLanguage==='kh'?'ពេលក្នុងឈុត':'applicable meals/set'}`;
                    label.append(input,text); fieldset.append(label);
                });
                box.append(fieldset);
            });
        };

        const styleChoiceButtons = (container) => {
            container.querySelectorAll('button').forEach(button => {
                const active = button.dataset.value === container.dataset.value;
                button.style.borderColor = active ? 'var(--brand-primary)' : '#e5e7eb';
                button.style.backgroundColor = active ? 'var(--brand-bg)' : '#fff';
                button.style.color = active ? 'var(--brand-text)' : '#374151';
                button.style.boxShadow = active ? '0 0 0 2px var(--brand-primary)' : 'none';
            });
        };

        const refreshPackageButtonPrices = () => {
            const box=document.getElementById('package-buttons');
            if(!box) return;
            const plan=document.getElementById('plan_type')?.value || 'weekly';
            const kh=currentLanguage==='kh';
            box.querySelectorAll('button').forEach(button=>{
                const code=button.dataset.value;
                const popular=code==='B' ? `<span class="text-xs px-2 py-1 rounded-full" style="background:var(--brand-primary);color:white;">${kh?'ពេញនិយមបំផុត':'Most Popular'}</span>` : '';
                button.disabled = !catalog || !catalog.packages.some(p=>p.plan_code===plan.toUpperCase()&&p.package_code===code&&p.status==='active'&&Number(p.price)>0);
                button.innerHTML=`<span class="flex justify-between items-start gap-2"><span class="text-xs font-bold">${kh?'ឈុត':'SET'} ${code}</span>${popular}</span><span class="block mt-2">${PACKAGE_NAMES[currentLanguage][code]}</span><span class="block mt-2 font-bold" style="color:var(--brand-primary);">${catalogPrice(plan,code)} / ${kh?(plan==='monthly'?'ខែ':'សប្ដាហ៍'):plan.replace('ly','')}</span>`;
            });
        };

        const convertSelectToButtons = (selectId, labels, columns = 'grid-cols-2') => {
            const select = document.getElementById(selectId);
            if (!select || document.getElementById(`${selectId}-buttons`)) return;
            select.classList.add('hidden');
            const container = document.createElement('div');
            container.id = `${selectId}-buttons`;
            container.dataset.value = select.value;
            container.className = `grid ${columns} gap-2`;
            [...select.options].forEach(option => {
                if (!option.value || (option.value === 'none' && selectId !== 'juice_option')) return;
                const button = document.createElement('button');
                button.type = 'button';
                button.dataset.value = option.value;
                button.className = 'p-3 rounded-xl border-2 text-sm font-semibold text-left transition-all';
                button.textContent = labels?.[option.value] || option.textContent;
                button.addEventListener('click', () => {
                    select.value = option.value;
                    container.dataset.value = option.value;
                    styleChoiceButtons(container);
                    select.dispatchEvent(new Event('change', {bubbles: true}));
                });
                container.appendChild(button);
            });
            select.insertAdjacentElement('afterend', container);
            styleChoiceButtons(container);
        };

        // Shows only the 3 package buttons matching the chosen Menu Focus, hiding the other 3.
        const filterPackageButtonsByFocus = (focus) => {
            const box = document.getElementById('package-buttons');
            if (!box) return;
            const visibleCodes = FOCUS_PACKAGE_GROUPS[focus] || FOCUS_PACKAGE_GROUPS.weight_loss;
            box.querySelectorAll('button').forEach(button => {
                button.classList.toggle('hidden', !visibleCodes.includes(button.dataset.value));
            });
        };

        // Combines the Menu Focus + Juice Option selections into the matching original package (A-F),
        // then applies it exactly as if that package button had been clicked directly.
        const updatePackageFromFocusJuice = () => {
            const focus = document.getElementById('menu_focus')?.value || 'weight_loss';
            const juice = document.getElementById('juice_option')?.value || 'none';
            const code = (FOCUS_JUICE_TO_PACKAGE[focus] || FOCUS_JUICE_TO_PACKAGE.weight_loss)[juice] || 'A';

            filterPackageButtonsByFocus(focus);

            const pkgSelect = document.getElementById('package');
            if (!pkgSelect) return;
            const changed = pkgSelect.value !== code;
            pkgSelect.value = code;

            const pkgButtons = document.getElementById('package-buttons');
            if (pkgButtons) {
                pkgButtons.dataset.value = code;
                styleChoiceButtons(pkgButtons);
            }

            if (changed) pkgSelect.dispatchEvent(new Event('change', { bubbles: true }));
        };

        // Keeps the Menu Focus / Juice Option buttons in sync if a package button is clicked directly.
        const syncFocusJuiceFromPackage = () => {
            const code = document.getElementById('package')?.value || 'A';
            const [focus, juice] = PACKAGE_TO_FOCUS_JUICE[code] || ['weight_loss', 'none'];

            const focusSelect = document.getElementById('menu_focus');
            const juiceSelect = document.getElementById('juice_option');
            if (focusSelect) focusSelect.value = focus;
            if (juiceSelect) juiceSelect.value = juice;

            const focusBox = document.getElementById('menu_focus-buttons');
            if (focusBox) { focusBox.dataset.value = focus; styleChoiceButtons(focusBox); }
            const juiceBox = document.getElementById('juice_option-buttons');
            if (juiceBox) { juiceBox.dataset.value = juice; styleChoiceButtons(juiceBox); }

            filterPackageButtonsByFocus(focus);
        };

        const setFriendlyStartDate = (offset, button) => {
            const date = new Date();
            date.setDate(date.getDate() + offset);
            const input = document.getElementById('start_date');
            input.value = localDate(date);
            document.querySelectorAll('.quick-date-btn').forEach(btn => btn.style.boxShadow = 'none');
            if (button) button.style.boxShadow = '0 0 0 2px var(--brand-primary)';
            input.dispatchEvent(new Event('change', {bubbles: true}));
        };

        const initializeFriendlyControls = () => {
            const ft = FRIENDLY_TEXT[currentLanguage] || FRIENDLY_TEXT.en;

            const focusJuiceLabels = FOCUS_JUICE_LABELS[currentLanguage] || FOCUS_JUICE_LABELS.en;
            document.getElementById('menu-focus-label').textContent = focusJuiceLabels.focus;
            document.getElementById('juice-option-label').textContent = focusJuiceLabels.juice;
            convertSelectToButtons('menu_focus', MENU_FOCUS_NAMES[currentLanguage] || MENU_FOCUS_NAMES.en, 'grid-cols-1 sm:grid-cols-2');
            convertSelectToButtons('juice_option', JUICE_OPTION_NAMES[currentLanguage] || JUICE_OPTION_NAMES.en, 'grid-cols-1 sm:grid-cols-3');

            convertSelectToButtons('package', PACKAGE_NAMES[currentLanguage] || PACKAGE_NAMES.en, 'grid-cols-1 sm:grid-cols-2');
            convertSelectToButtons('plan_type', {weekly:ft.weekly, monthly:ft.monthly});
            convertSelectToButtons('subscriber_type', {new:ft.newCustomer, old:ft.returning});

            const qty = document.getElementById('quantity');
            if (qty && !document.getElementById('quantity-buttons')) {
                qty.classList.add('hidden');
                const box = document.createElement('div');
                box.id = 'quantity-buttons'; box.className = 'grid grid-cols-4 gap-2';
                [1,2,3].forEach(n => {
                    const b = document.createElement('button'); b.type = 'button'; b.textContent = String(n);
                    b.className = 'p-3 rounded-xl border-2 font-bold';
                    b.onclick = () => { qty.classList.add('hidden'); qty.value = n; handleQuantityChange(); [...box.children].forEach(x=>x.style.boxShadow='none'); b.style.boxShadow='0 0 0 2px var(--brand-primary)'; };
                    box.appendChild(b); if(n===1) b.style.boxShadow='0 0 0 2px var(--brand-primary)';
                });
                const more = document.createElement('button'); more.type='button'; more.textContent='4+'; more.className='p-3 rounded-xl border-2 font-bold';
                more.onclick=()=>{ qty.classList.remove('hidden'); qty.focus(); }; box.appendChild(more); qty.insertAdjacentElement('afterend', box);
            }

            const start = document.getElementById('start_date');
            if (start && !document.getElementById('quick-date-buttons')) {
                const box=document.createElement('div'); box.id='quick-date-buttons'; box.className='grid grid-cols-3 gap-2 mb-3';
                [[ft.tomorrow,1],[ft.dayAfter,2],[ft.monday,((8-new Date().getDay())%7)||7]].forEach(([label,offset],i)=>{const b=document.createElement('button'); b.type='button'; b.textContent=label; b.className='quick-date-btn p-3 rounded-xl border-2 text-sm font-semibold'; b.onclick=()=>setFriendlyStartDate(offset,b); box.appendChild(b); if(i===0)setTimeout(()=>setFriendlyStartDate(1,b),0);});
                start.insertAdjacentElement('beforebegin',box);
            }

            document.querySelectorAll('input[name="method"]').forEach(input=>{const label=input.closest('label'); input.classList.add('sr-only'); label.classList.add('method-choice','p-3','rounded-xl','border-2','flex-1','justify-center');});
            updateMethodButtonStyles();

            const time = document.getElementById('time_slot');
            if(time){time.innerHTML='<option value="8:00 AM - 10:00 AM">8:00 AM–10:00 AM</option><option value="10:00 AM - 12:00 PM">10:00 AM–12:00 PM</option><option value="3:00 PM - 5:00 PM">3:00–5:00 PM</option><option value="4:00 PM - 6:00 PM">4:00–6:00 PM</option>'; convertSelectToButtons('time_slot',null,'grid-cols-1 sm:grid-cols-4');}
            convertSelectToButtons('pickup_time',null,'grid-cols-1 sm:grid-cols-3');

            const remarkBox=document.getElementById('remark-quick-options');
            REMARK_OPTIONS.forEach(item=>{const b=document.createElement('button');b.type='button';b.dataset.value=item.value;b.textContent=item[currentLanguage];b.className='p-2 rounded-lg border text-xs font-semibold';b.onclick=()=>{const input=document.getElementById('remark');const parts=input.value.split(',').map(x=>x.trim()).filter(Boolean);const pos=parts.findIndex(part=>part===item.en||part===item.kh);if(pos>=0){parts.splice(pos,1);b.style.boxShadow='none';}else{parts.push(item[currentLanguage]);b.style.boxShadow='0 0 0 2px var(--brand-primary)';}input.value=parts.join(', ');input.dispatchEvent(new Event('input',{bubbles:true}));};remarkBox.appendChild(b);});

            const addonBox=document.getElementById('addon-options');
            document.getElementById('addon-title').textContent=ft.addonTitle;
            document.getElementById('addon-note').textContent=ft.addonNote;
            document.getElementById('remark-title').textContent=ft.remarkTitle;
            document.getElementById('subscriber-title').textContent=ft.subscriberTitle;
            document.getElementById('send-ticket-btn').textContent=ft.telegram;
            document.getElementById('ticket-instructions').textContent=ft.ticketInstructions;
            document.getElementById('district-optional-label').textContent=ft.districtOptional;
            document.getElementById('summary-addon-label').textContent=currentLanguage==='kh'?'បន្ថែមមុខម្ហូប':'Add-ons';
            updateTicketControlLanguage();
            refreshPackageButtonPrices();

            const menuFocusSelect = document.getElementById('menu_focus');
            const juiceOptionSelect = document.getElementById('juice_option');
            if (menuFocusSelect && !menuFocusSelect.dataset.boundFocusJuice) {
                menuFocusSelect.addEventListener('change', updatePackageFromFocusJuice);
                menuFocusSelect.dataset.boundFocusJuice = '1';
            }
            if (juiceOptionSelect && !juiceOptionSelect.dataset.boundFocusJuice) {
                juiceOptionSelect.addEventListener('change', updatePackageFromFocusJuice);
                juiceOptionSelect.dataset.boundFocusJuice = '1';
            }
            const pkgSelectEl = document.getElementById('package');
            if (pkgSelectEl && !pkgSelectEl.dataset.boundFocusJuiceSync) {
                pkgSelectEl.addEventListener('change', syncFocusJuiceFromPackage);
                pkgSelectEl.dataset.boundFocusJuiceSync = '1';
            }
            updatePackageFromFocusJuice();
        };

        const refreshFriendlyLanguage = () => {
            const ft=FRIENDLY_TEXT[currentLanguage] || FRIENDLY_TEXT.en;
            const updateButtons=(id,map)=>{const box=document.getElementById(id);if(box)[...box.querySelectorAll('button')].forEach(btn=>{if(map[btn.dataset.value])btn.textContent=map[btn.dataset.value];});};
            updateButtons('package-buttons',PACKAGE_NAMES[currentLanguage] || PACKAGE_NAMES.en);
            updateButtons('menu_focus-buttons',MENU_FOCUS_NAMES[currentLanguage] || MENU_FOCUS_NAMES.en);
            updateButtons('juice_option-buttons',JUICE_OPTION_NAMES[currentLanguage] || JUICE_OPTION_NAMES.en);
            const fjLabels = FOCUS_JUICE_LABELS[currentLanguage] || FOCUS_JUICE_LABELS.en;
            document.getElementById('menu-focus-label').textContent = fjLabels.focus;
            document.getElementById('juice-option-label').textContent = fjLabels.juice;
            filterPackageButtonsByFocus(document.getElementById('menu_focus')?.value || 'weight_loss');
            updateButtons('plan_type-buttons',{weekly:ft.weekly,monthly:ft.monthly});
            updateButtons('subscriber_type-buttons',{new:ft.newCustomer,old:ft.returning});
            const dates=document.querySelectorAll('.quick-date-btn'); if(dates.length===3)[ft.tomorrow,ft.dayAfter,ft.monday].forEach((v,i)=>dates[i].textContent=v);
            const remarkInput=document.getElementById('remark');
            const remarkParts=remarkInput.value.split(',').map(x=>x.trim()).filter(Boolean).map(part=>{const item=REMARK_OPTIONS.find(x=>x.en===part||x.kh===part);return item?item[currentLanguage]:part;});
            remarkInput.value=remarkParts.join(', ');
            document.querySelectorAll('#remark-quick-options button').forEach((b,i)=>b.textContent=REMARK_OPTIONS[i][currentLanguage]);
            const pickupButtons=document.getElementById('pickup_time-buttons');
            if(pickupButtons){pickupButtons.remove();document.getElementById('pickup_time').classList.remove('hidden');convertSelectToButtons('pickup_time',null,'grid-cols-1 sm:grid-cols-3');}
            document.getElementById('addon-title').textContent=ft.addonTitle;
            document.getElementById('addon-note').textContent=ft.addonNote;
            document.getElementById('remark-title').textContent=ft.remarkTitle;
            document.getElementById('subscriber-title').textContent=ft.subscriberTitle;
            document.getElementById('send-ticket-btn').textContent=ft.telegram;
            document.getElementById('ticket-instructions').textContent=ft.ticketInstructions;
            document.getElementById('district-optional-label').textContent=ft.districtOptional;
            document.getElementById('summary-addon-label').textContent=currentLanguage==='kh'?'បន្ថែមមុខម្ហូប':'Add-ons';
            updateTicketControlLanguage();
            refreshPackageButtonPrices();
        };

        // --- MULTI-SET LOGIC FUNCTIONS ---
        const handleQuantityChange = () => {
            const qtyInput = document.getElementById('quantity');
            const multiOptDiv = document.getElementById('multi-set-options');
            const diffCheck = document.getElementById('diff_packages_check');

            let qty = parseInt(qtyInput.value) || 1;

            if (qty > 1) {
                multiOptDiv.classList.remove('hidden');
            } else {
                multiOptDiv.classList.add('hidden');
                diffCheck.checked = false;
                handleDiffCheck();
            }

            if (diffCheck.checked) {
                renderAdditionalPackages(qty);
            }
            updatePriceSummary();
        };

        const handleDiffCheck = () => {
            const diffCheck = document.getElementById('diff_packages_check');
            const container = document.getElementById('additional-packages-container');
            const qtyInput = document.getElementById('quantity');
            let qty = parseInt(qtyInput.value) || 1;

            if (diffCheck.checked) {
                container.classList.remove('hidden');
                renderAdditionalPackages(qty);
            } else {
                container.classList.add('hidden');
                container.innerHTML = '';
            }
            updatePriceSummary();
        };

        const renderAdditionalPackages = (qty) => {
            const container = document.getElementById('additional-packages-container');
            container.innerHTML = '';

            const extrasNeeded = Math.min(100, Math.max(1, qty)) - 1;
            const t = translations[currentLanguage];
            const labelTemplate = t.label_package_num || "Package #{n}";
            const options = ['A', 'B', 'C', 'D', 'E', 'F'];

            for (let i = 0; i < extrasNeeded; i++) {
                const num = i + 2;
                const wrapper = document.createElement('div');
                wrapper.className = "flex flex-col";

                const label = document.createElement('label');
                label.className = "text-xs font-bold text-[var(--brand-hint)] mb-1";
                label.textContent = labelTemplate.replace('{n}', num);

                const select = document.createElement('select');
                select.className = "w-full p-2 text-sm form-select additional-pkg-select bg-white border border-gray-300 rounded";
                select.onchange = updatePriceSummary;

                options.forEach(opt => {
                    const pkgNameKey = 'package_' + opt.toLowerCase();
                    const pkgName = t[pkgNameKey] || `Package ${opt}`;
                    const optionEl = document.createElement('option');
                    optionEl.value = opt;
                    optionEl.textContent = pkgName;
                    select.appendChild(optionEl);
                });

                wrapper.appendChild(label);
                wrapper.appendChild(select);
                container.appendChild(wrapper);
            }
        };

        // --- MOCK TELEGRAM OBJECT ---
        let tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : {
            ready: () => console.log('Telegram.WebApp.ready() mock'),
            expand: () => console.log('Telegram.WebApp.expand() mock'),
            showAlert: (message, callback) => {
                alert(message);
                if (callback) callback();
            },
            close: () => console.log('Telegram.WebApp.close() mock'),
            initDataUnsafe: { user: { id: 123456, first_name: 'Dev', last_name: 'User', username: 'devuser' } },
            openTelegramLink: (url) => {
                 console.log(`Mock: Opening Telegram link: ${url}`);
                 window.open(url, '_blank');
            },
            platform: 'unknown',
            MainButton: {
                _text: 'Button', _color: '#606C38', _textColor: '#FFFFFF', _isVisible: false, _onClickHandler: null,
                setText: function(text) { this._text = text; },
                setParams: function(params) { if(params.color) this._color = params.color; if(params.text_color) this._textColor = params.text_color; },
                show: function() { this._isVisible = true; },
                hide: function() { this._isVisible = false; },
                onClick: function(callback) { this._onClickHandler = callback; },
                offClick: function(callback) { if(this._onClickHandler === callback) this._onClickHandler = null; },
                _click: function() { if (this._isVisible && this._onClickHandler) this._onClickHandler(); }
            }
        };

        // --- GLOBAL STATE ---
        let currentLanguage = 'en';
        let isTelegramEnv = false;
        let isMobilePlatform = false;

        // --- UTILITY FUNCTIONS ---
        const showAlert = message => { const status=document.getElementById('checkout-status'); status.textContent=message; status.scrollIntoView({block:'nearest'}); };

        const formatDate = (dateString) => {
            if (!dateString) return '';
            const parts = dateString.split('-');
            if (parts.length !== 3) return dateString;
            const year = parts[0];
            const month = parseInt(parts[1], 10);
            const day = parts[2];

            const t = translations[currentLanguage];
            const monthNames = t.months || ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            return `${day}-${monthNames[month - 1]}-${year}`;
        };

        // --- FUNCTIONS ---
        const setLanguage = (lang) => {
            if (!translations[lang]) return;
            const previousLanguage=currentLanguage;
            const districtIndex=DATA[previousLanguage].districts.indexOf(document.getElementById('district').value);
            const communeIndex=(DATA[previousLanguage].communes[document.getElementById('district').value]||[]).indexOf(document.getElementById('commune').value);
            const pickupIndex=DATA[previousLanguage].pickup_times.indexOf(document.getElementById('pickup_time').value);
            currentLanguage = lang;
            document.documentElement.lang=lang==='kh'?'km':'en';
            const t = translations[lang];

            document.querySelectorAll('[data-lang-key]').forEach(el => {
                const key = el.getAttribute('data-lang-key');
                if ((el.tagName === 'BUTTON' || el.tagName === 'A') && el.querySelector('.button-text')) {
                     const textSpan = el.querySelector('.button-text');
                     if(textSpan && t[key]) textSpan.textContent = t[key];
                 } else if (el.id === 'generate-ticket-btn') {
                     if (t.btn_generate_ticket) el.textContent = t.btn_generate_ticket;
                 } else if (t[key]) {
                    if (el.tagName === 'LI' && el.parentElement.getAttribute('data-lang-key')) {
                         el.textContent = t[key];
                    } else if (el.tagName === 'OPTION') {
                         el.textContent = t[key];
                    } else if (el.tagName !== 'UL') {
                         el.textContent = t[key];
                    }
                 }
            });

            document.querySelectorAll('[data-lang-key-placeholder]').forEach(el => {
                const key = el.getAttribute('data-lang-key-placeholder');
                if (t[key]) el.placeholder = t[key];
            });

            const earlyDeliveryPolicy = document.getElementById('policy-delivery-early-slot');
            if (earlyDeliveryPolicy) {
                earlyDeliveryPolicy.textContent = lang === 'kh'
                    ? 'ការដឹកពេលព្រឹក៖ 8:00 ព្រឹក – 10:00 ព្រឹក'
                    : 'Morning Delivery: 8:00 AM – 10:00 AM';
            }

            const user = tg.initDataUnsafe?.user;
            const welcomeText = user && user.first_name ? `${t.welcome} ${user.first_name}!` : t.header_subtitle;
            document.getElementById('welcome-message').textContent = welcomeText;

            document.getElementById('lang-en').classList.toggle('active', lang === 'en');
            document.getElementById('lang-kh').classList.toggle('active', lang === 'kh');

            populateSelect('district', DATA[lang].districts, true, 'select_district_placeholder');
            const districtSelect = document.getElementById('district');
            if (districtSelect?.options?.[0]) districtSelect.options[0].textContent = FRIENDLY_TEXT[lang].districtPlaceholder;
            if(districtIndex>=0) districtSelect.value=DATA[lang].districts[districtIndex];
            if (districtSelect) updateCommuneOptions(districtSelect.value);
            else updateCommuneOptions();
            if(communeIndex>=0)document.getElementById('commune').value=DATA[lang].communes[districtSelect.value]?.[communeIndex] || '';

            populateSelect('time_slot', ['8:00 AM - 10:00 AM', '10:00 AM - 12:00 PM', '3:00 PM - 5:00 PM', '4:00 PM - 6:00 PM']);
            populateSelect('pickup_time', DATA[lang].pickup_times);
            if(pickupIndex>=0)document.getElementById('pickup_time').value=DATA[lang].pickup_times[pickupIndex];

            showMenuImage();
            updatePlanNotesVisibility();
            updatePriceSummary();
            refreshFriendlyLanguage();
            refreshCheckoutState();

            const modal = document.getElementById('ticket-modal');
            if (modal && !modal.classList.contains('hidden')) {
                const formData = getFormData('meal-order-form');
                const ticketCardHtml = generateTicketCardHTML(formData);
                const ticketCardDiv = document.getElementById('ticket-card');
                if(ticketCardDiv) ticketCardDiv.innerHTML = ticketCardHtml;
                const ticketTextArea = document.getElementById('ticket-text-area');
                if(ticketTextArea) ticketTextArea.value = generateTicketPlainText(formData);
                generateQRCodes();
                renderOrderQrCode(`https://t.me/${ADMIN_USERNAME}?text=${encodeURIComponent(buildOrderQrPayload())}`);
            }

            const nutBtnText = document.getElementById('btn-nutrition-text');
            if (nutBtnText && window.NUTRITION_DATA) {
                 const labelKey = lang === 'kh' ? 'kh' : 'en';
                 nutBtnText.textContent = window.NUTRITION_DATA.labels.btn_view[labelKey];
            }
        };

        const updateCommuneOptions = (selectedDistrict) => {
            const communeSelect = document.getElementById('commune');
            if (!communeSelect) return;

            const currentCommuneValue = communeSelect.value;
            communeSelect.innerHTML = '';

            const placeholderOption = document.createElement('option');
            placeholderOption.value = "";
            placeholderOption.textContent = translations[currentLanguage].select_commune_placeholder || "-- Select Commune --";
            communeSelect.appendChild(placeholderOption);

            const communesForDistrict = DATA[currentLanguage].communes[selectedDistrict];

            if (communesForDistrict && communesForDistrict.length > 0) {
                communesForDistrict.forEach(commune => {
                    const option = document.createElement('option');
                    option.value = commune;
                    option.textContent = commune;
                    communeSelect.appendChild(option);
                });
                communeSelect.disabled = false;
                 if (communesForDistrict.includes(currentCommuneValue)) {
                     communeSelect.value = currentCommuneValue;
                 } else {
                     communeSelect.value = "";
                 }
            } else {
                communeSelect.disabled = true;
                 communeSelect.value = "";
            }
        };

        const updatePlanNotesVisibility = () => {
             const planSelect = document.getElementById('plan_type');
             const weeklyNote = document.getElementById('weekly-plan-note');
             const monthlyNote = document.getElementById('monthly-plan-note');

             if (!planSelect || !weeklyNote || !monthlyNote) return;

             const selectedPlan = planSelect.value;
             weeklyNote.classList.toggle('hidden', selectedPlan !== 'weekly');
             monthlyNote.classList.toggle('hidden', selectedPlan !== 'monthly');
        };

        const toggleMethodFields = () => {
            const methodRadio = document.querySelector('input[name="method"]:checked');
            if (!methodRadio) return;
            const method = methodRadio.value;
            const deliveryFields = document.getElementById('delivery-fields');
            const pickupFields = document.getElementById('pickup-fields');
            if (deliveryFields) deliveryFields.style.display = (method === 'delivery') ? 'block' : 'none';
            if (pickupFields) pickupFields.style.display = (method === 'pickup') ? 'block' : 'none';
            updateMethodButtonStyles();
            updatePriceSummary();
        };

        const updateMethodButtonStyles = () => {
            document.querySelectorAll('input[name="method"]').forEach(input => {
                const label=input.closest('label');
                if(label) label.classList.toggle('selected',input.checked);
            });
        };

        const populateSelect = (elementId, options, addPlaceholder = false, placeholderKey = null) => {
            const select = document.getElementById(elementId);
            if (!select) return;
            const currentValue = select.value;
            select.innerHTML = '';

             if (addPlaceholder && placeholderKey) {
                 const placeholderOption = document.createElement('option');
                 placeholderOption.value = "";
                 placeholderOption.textContent = translations[currentLanguage][placeholderKey] || "-- Select --";
                 select.appendChild(placeholderOption);
             }

            let valueExists = false;
            if (options && Array.isArray(options)) {
                options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt;
                    select.appendChild(option);
                    if (opt === currentValue) valueExists = true;
                });
            } else {
                console.warn(`No options provided or options is not an array for select element: ${elementId}`);
            }

             if (valueExists) {
                select.value = currentValue;
             } else if (!addPlaceholder && options && options.length > 0) {
                 select.value = options[0];
             } else if (addPlaceholder) {
                 select.value = "";
             }
        };

        const setMinStartDate = () => {
            const startDateInput = document.getElementById('start_date');
            if (!startDateInput) return;
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const yyyy = tomorrow.getFullYear();
            const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
            const dd = String(tomorrow.getDate()).padStart(2, '0');
            const minDate = `${yyyy}-${mm}-${dd}`;
            startDateInput.min = minDate;
            if (!startDateInput.value || startDateInput.value < minDate) {
                 startDateInput.value = minDate;
            }
        };

        const showMenuImage = () => {
            const pkgSelect = document.getElementById('package');
            if (!pkgSelect) return;
            const pkg = pkgSelect.value;
            const loader = document.getElementById('menu-image-loader');
            const imgEl = document.getElementById('menu-image');
            const errEl = document.getElementById('menu-image-error');
            const t = translations[currentLanguage];

            if (!loader || !imgEl || !errEl) return;

            loader.style.display = 'flex';
            loader.textContent = t.menu_loading;
            imgEl.style.display = 'none';
            errEl.style.display = 'none';

            const s3_bucket_name = "vearuny-kitchen-menus";
            const aws_region = "ap-southeast-2";

            const imageName = currentLanguage === 'kh' ? pkg.toLowerCase() : pkg.toUpperCase();
            const imageUrl = `assets/menus/${imageName}.jpg`;

            const img = new Image();
            img.src = imageUrl;
            img.alt = `Menu for Package ${pkg}`;

            img.onload = () => {
                imgEl.src = imageUrl;
                loader.style.display = 'none';
                imgEl.style.display = 'block';
                errEl.style.display = 'none';
            };

            img.onerror = () => {
                const fallbackImageName = currentLanguage === 'kh' ? pkg.toUpperCase() : pkg.toLowerCase();
                const fallbackUrl = `assets/menus/${fallbackImageName}.jpg`;
                const fallbackImg = new Image();
                fallbackImg.src = fallbackUrl;

                fallbackImg.onload = () => {
                    imgEl.src = fallbackUrl;
                    loader.style.display = 'none';
                    imgEl.style.display = 'block';
                    errEl.style.display = 'none';
                };
                fallbackImg.onerror = () => {
                    errEl.textContent = t.menu_unavailable;
                    loader.style.display = 'none';
                    imgEl.style.display = 'none';
                    errEl.style.display = 'flex';
                };
            };
        };

        const catalogPrice = (plan, code) => {
            try { return '$' + CheckoutAPI.packageFor(catalog,plan,code).price; } catch { return '—'; }
        };
        const localDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        let quoteTimer = null;
        let quoteSequence = 0;
        let latestQuote = null;
        const setQuoteLoading = loading => {
            const state=document.getElementById('quote-state');
            if(state) { state.textContent=loading ? (currentLanguage==='kh'?'កំពុងគណនា…':'Updating total…') : ''; state.classList.toggle('is-loading',loading); }
        };
        const renderQuote = quote => {
            latestQuote=quote;
            const money=value=>`$${Number(value).toFixed(2)}`;
            document.getElementById('summary-package-cost').textContent=money(quote.base_amount);
            document.getElementById('summary-addon-cost').textContent=money(quote.addon_total);
            document.getElementById('summary-delivery-cost').textContent=money(quote.delivery_fee);
            document.getElementById('summary-total-cost').textContent=money(quote.total_amount);
            document.getElementById('summary-discount').textContent=`-${money(quote.discount_amount)} (${quote.discount_percentage}%)`;
            document.getElementById('discount-row').style.display=Number(quote.discount_amount)>0?'flex':'none';
            document.getElementById('addon-cost-row').style.display=Number(quote.addon_total)>0?'flex':'none';
            document.getElementById('delivery-cost-row').style.display='flex';
            const breakdown=document.getElementById('summary-breakdown');
            if(breakdown) breakdown.innerHTML=quote.items.map(item=>`<div class="quote-item"><div><strong>${escapeHTML(item.package_code)} × ${item.quantity}</strong><span>${escapeHTML(item.package_name || '')}</span></div><strong>${money(item.base_amount)}</strong>${item.addons.map(addon=>`<div class="quote-addon"><span>＋ ${escapeHTML(addon.name)} × ${addon.billable_meal_count}</span><span>${money(addon.total_amount)}</span></div>`).join('')}</div>`).join('');
        };
        const requestQuote = () => {
            if(!checkoutClient || !catalog || checkoutClient.attempt?.receipt) return;
            clearTimeout(quoteTimer);
            quoteTimer=setTimeout(async()=>{
                const sequence=++quoteSequence;
                try {
                    const form=getFormData('meal-order-form'), quantity=Number(form.quantity);
                    if(!Number.isInteger(quantity)||quantity<1||quantity>100) return;
                    const sets=getOrderedPackages(quantity).map((code,index)=>({code,addons:[...(selectedAddons.get(index)||[])].sort((a,b)=>a-b)}));
                    const payload=CheckoutAPI.buildPayload(catalog,form,sets,currentLanguage,{quote:true});
                    setQuoteLoading(true);
                    const quote=await checkoutClient.quote(payload.order);
                    if(sequence===quoteSequence) renderQuote(quote);
                } catch(error) {
                    if(sequence===quoteSequence) { latestQuote=null; document.getElementById('summary-total-cost').textContent='—'; showAlert(`${apiText().error} ${error.message}`); }
                } finally { if(sequence===quoteSequence) setQuoteLoading(false); }
            },250);
        };
        const updatePriceSummary = () => {
            const plan = document.getElementById('plan_type').value;
            const quantity = Number(document.getElementById('quantity').value);
            let base = null;
            if (catalog && Number.isInteger(quantity) && quantity>0 && quantity<=100) {
                try { base = getOrderedPackages(quantity).reduce((sum,code)=>sum+Math.round(Number(CheckoutAPI.packageFor(catalog,plan,code).price)*100),0)/100; } catch {}
            }
            document.getElementById('summary-package-cost').textContent = base===null?'—':`$${base.toFixed(2)}`;
            latestQuote=null;
            document.getElementById('summary-total-cost').textContent = '—';
            document.getElementById('total-meal-info').textContent = apiText().pending;
            for (const id of ['discount-row','delivery-cost-row','delivery-fee-note','promo-status']) document.getElementById(id).style.display='none';
            document.getElementById('addon-cost-row').style.display='flex';
            document.getElementById('summary-addon-cost').textContent='—';
            const delivery = document.querySelector('input[name="method"]:checked')?.value==='delivery';
            for (const id of ['district','commune','address']) document.getElementById(id).required=delivery;
            document.querySelector('label[for="commune"]').textContent=currentLanguage==='kh'?'សង្កាត់ *':'Commune *';
            document.getElementById('nutrition-notes-label').textContent=apiText().nutrition;
            renderAddons();
            refreshCheckoutState();
            requestQuote();
        };
        const refreshCheckoutState = () => {
            const attempt = checkoutClient?.attempt;
            const locked = Boolean(attempt && !attempt.rejected);
            const form = document.getElementById('meal-order-form');
            form.querySelectorAll('input,select,textarea,button').forEach(el => {
                if (el.id==='generate-ticket-btn' || el.id==='new-order-btn') return;
                if (locked) { if (!el.disabled) {el.dataset.checkoutLocked='1'; el.disabled=true;} }
                else if(el.dataset.checkoutLocked) {el.disabled=false; delete el.dataset.checkoutLocked;}
            });
            const button = document.getElementById('generate-ticket-btn');
            button.disabled=!checkoutClient || checkoutClient.pending || (!catalog && !attempt) || Boolean(attempt?.receipt);
            button.textContent=checkoutClient?.pending?apiText().loading:attempt&&!attempt.rejected?apiText().retry:apiText().create;
            button.setAttribute('aria-busy',String(Boolean(checkoutClient?.pending)));
            const reset = document.getElementById('new-order-btn');
            document.getElementById('receipt-open-btn').hidden=!attempt?.receipt;
            reset.hidden=!(attempt?.receipt || attempt?.rejected); reset.textContent=apiText().newOrder;
            document.getElementById('ticket-instructions').textContent=apiText().created;
        };
        let restoredAttempt = false;
        const restoreAttemptForm = () => {
            const attempt=checkoutClient?.attempt;
            if (!attempt || restoredAttempt || !catalog) return;
            const order=attempt.order;
            const plan=catalog.plans.find(p=>p.id===order.meal_plan_id);
            if (!plan) return; // Exact frozen payload remains retryable even if its catalog disappeared.
            const sets=order.items.flatMap(item=>Array.from({length:item.quantity},()=>({code:catalog.packages.find(p=>p.id===item.package_id)?.package_code,addons:item.addons})));
            if(sets.some(set=>!set.code))return;
            restoredAttempt=true;
            const value=(id,v)=>{document.getElementById(id).value=v || '';};
            value('plan_type',plan.code.toLowerCase()); value('quantity',sets.length); value('package',sets[0].code);
            document.getElementById('diff_packages_check').checked=sets.some(set=>set.code!==sets[0].code);
            handleQuantityChange();
            document.querySelectorAll('.additional-pkg-select').forEach((select,index)=>{select.value=sets[index+1].code;});
            selectedAddons.clear();sets.forEach((set,index)=>selectedAddons.set(index,new Set(set.addons.map(a=>a.id))));
            value('customer_name',attempt.customer.name);value('phone',attempt.customer.phone);
            for(const id of ['start_date','subscriber_type','nutrition_notes'])value(id,order[id]);
            value('subscription_number',order.previous_subscription_number);value('remark',order.customer_remarks);
            value('address',order.address);
            const originalLang=attempt.customer.language==='KH'?'kh':'en';
            const districtIndex=DATA[originalLang].districts.indexOf(order.district);
            value('district',districtIndex>=0?DATA[currentLanguage].districts[districtIndex]:order.district);
            updateCommuneOptions(document.getElementById('district').value);
            const communeIndex=(DATA[originalLang].communes[order.district]||[]).indexOf(order.commune);
            value('commune',communeIndex>=0?DATA[currentLanguage].communes[document.getElementById('district').value]?.[communeIndex]:order.commune);
            document.querySelectorAll('input[name="method"]').forEach(input=>{input.checked=input.value===order.fulfillment_method;});
            value(order.fulfillment_method==='pickup'?'pickup_time':'time_slot',order.fulfillment_time);
            syncFocusJuiceFromPackage();handleSubscriberTypeChange();toggleMethodFields();refreshFriendlyLanguage();
        };
        const loadCatalog = async () => {
            if (catalogLoading) return;
            catalogLoading=true;
            showAlert(apiText().catalog);
            try {
                catalog=await checkoutClient.catalog();
                restoreAttemptForm();
                document.getElementById('catalog-retry-btn').hidden=true;
                showAlert(checkoutClient.attempt?apiText().recovery:'');
                refreshPackageButtonPrices(); updatePriceSummary();
            } catch(error) { showAlert(`${apiText().error} ${error.message}`); document.getElementById('catalog-retry-btn').hidden=false; }
            finally { catalogLoading=false; refreshCheckoutState(); }
        };

        const validateForm = (formId) => {
            const form = document.getElementById(formId);
            if (!form) return false;
            const t = translations[currentLanguage];
            const requiredFields = {'meal-order-form': ['package', 'plan_type', 'quantity', 'start_date', 'customer_name', 'phone']};

            if (!requiredFields[formId]) return true;

            for (const fieldName of requiredFields[formId]) {
                const field = form.querySelector(`[name="${fieldName}"]`);
                if (!field || !field.value || !field.value.trim()) {
                    let label = field?.labels?.[0];
                    if (!label) {
                        let parentDiv = field.closest('div');
                         label = parentDiv ? parentDiv.querySelector('label') : null;
                         if (!label && parentDiv?.parentElement) {
                             label = parentDiv.parentElement.querySelector('label');
                         }
                    }
                    if (!label && field?.id) {
                         label = form.querySelector(`label[for="${field.id}"]`);
                    }
                    const fieldNameText = label ? label.textContent.replace(/[0-9.]/g, '').replace('(Optional)', '').replace('(មិនតម្រូវ)', '').trim() : fieldName;
                    showAlert(t.alert_fill_field.replace('{fieldName}', fieldNameText || fieldName));
                    field?.focus();
                    return false;
                }
            }

            const methodRadio = form.querySelector('input[name="method"]:checked');
            if (methodRadio && methodRadio.value === 'delivery') {
                const addressField = form.querySelector('[name="address"]');
                if (!addressField || !addressField.value || !addressField.value.trim()) {
                    let label = form.querySelector('label[for="address"]');
                    const fieldNameText = label ? label.textContent.replace('(Optional)', '').replace('(មិនតម្រូវ)', '').trim() : 'Address';
                    showAlert(t.alert_fill_field.replace('{fieldName}', fieldNameText));
                    addressField?.focus();
                    return false;
                }
            }

            const subType = form.querySelector('#subscriber_type').value;
            const subNumber = form.querySelector('#subscription_number').value.trim();
            if (subType === 'old' && subNumber === '') {
                const label = form.querySelector('label[for="subscription_number"]');
                const fieldNameText = label ? label.textContent.trim() : 'Last Subscription Number';
                showAlert(t.alert_fill_field.replace('{fieldName}', fieldNameText));
                form.querySelector('#subscription_number').focus();
                return false;
            }

            return true;
        };

        const getFormData = (formId) => {
            const form = document.getElementById(formId);
            if (!form) return {};
            const inputs = form.querySelectorAll('input, select, textarea');
            const data = {};
            inputs.forEach(input => {
                if (input.name) {
                    if (input.type === 'radio') {
                         if (input.checked) data[input.name] = input.value;
                    } else {
                        data[input.name] = input.value;
                    }
                }
            });
            const checkedMethod = form.querySelector('input[name="method"]:checked');
            if (checkedMethod) {
                data.method = checkedMethod.value;
            }
            return data;
        };

        const generateQRCodes = () => {
            const qrUsdContainer = document.getElementById('qrcode-usd');
            const qrKhrContainer = document.getElementById('qrcode-khr');

            if (!qrUsdContainer || !qrKhrContainer || typeof QRCode === 'undefined') {
                console.error('QR code containers or library not found.');
                qrCodeUsdDataUrl = null;
                qrCodeKhrDataUrl = null;
                return;
            }

            qrUsdContainer.innerHTML = '';
            qrKhrContainer.innerHTML = '';

            try {
                 new QRCode(qrUsdContainer, {
                     text: PAYWAY_USD_LINK,
                     width: 128,
                     height: 128,
                     colorDark : "#000000",
                     colorLight : "#ffffff",
                     correctLevel : QRCode.CorrectLevel.H
                 });
             } catch(e) { console.error("Error generating USD QR:", e); qrCodeUsdDataUrl = null; }

             try {
                 new QRCode(qrKhrContainer, {
                     text: PAYWAY_KHR_LINK,
                     width: 128,
                     height: 128,
                     colorDark : "#000000",
                     colorLight : "#ffffff",
                     correctLevel : QRCode.CorrectLevel.H
                 });
             } catch(e) { console.error("Error generating KHR QR:", e); qrCodeKhrDataUrl = null; }

             setTimeout(() => {
                 const usdCanvas = qrUsdContainer.querySelector('canvas');
                 const khrCanvas = qrKhrContainer.querySelector('canvas');

                 qrCodeUsdDataUrl = usdCanvas ? usdCanvas.toDataURL("image/png") : null;
                 qrCodeKhrDataUrl = khrCanvas ? khrCanvas.toDataURL("image/png") : null;
             }, 150);
        };


        // Keep the Telegram payload compact. Long t.me URLs are unreliable on some mobile browsers.
        const generateTicketPlainText = () => CheckoutAPI.receiptLines(receipt(), currentLanguage).map(([key,value])=>`${key}: ${value}`).join('\n');
        const generateTicketCardHTML = () => {
            const lines = CheckoutAPI.receiptLines(receipt(),currentLanguage);
            if (!lines.length) return '';
            return `<div class="ticket-flipper"><section class="ticket-face ticket-front"><div class="boarding-pass-layout"><div class="boarding-main"><img src="graylogo.png" alt="Vearuny" class="h-16 mx-auto"><div class="ticket-section-title">${escapeHTML(apiText().created)}</div>${lines.map(([k,v])=>`<div class="ticket-item"><span>${escapeHTML(k)}</span><strong>${escapeHTML(v)}</strong></div>`).join('')}<div class="mt-4 text-center">${escapeHTML(translations[currentLanguage].payment_instructions || (currentLanguage==='kh'?'សូមទូទាត់តាម PayWay':'Pay using the existing PayWay links'))}<div class="payment-qr-grid"><div><a href="${PAYWAY_USD_LINK}" target="_blank" rel="noopener">PayWay USD</a><div id="qrcode-usd"></div></div><div><a href="${PAYWAY_KHR_LINK}" target="_blank" rel="noopener">PayWay KHR</a><div id="qrcode-khr"></div></div></div></div></div></div></section><section class="ticket-face ticket-back"><div class="qr-ticket-brand"><img class="qr-ticket-logo" src="graylogo.png" alt="Vearuny"></div><h3>${escapeHTML(FRIENDLY_TEXT[currentLanguage].qrTitle)}</h3><div id="order-qr-code" class="order-qr-code"></div><p>${escapeHTML(receipt().order.order_code)}</p><p>${escapeHTML(FRIENDLY_TEXT[currentLanguage].qrHelp)}</p></section></div>`;
        };

        const copyTicketSummary = async () => {
            const statusP = document.getElementById('send-status');
            if (!statusP) return;
            const formData = getFormData('meal-order-form');
            const ticketText = generateTicketPlainText(formData);
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(ticketText);
                } else {
                    const textArea = document.getElementById('ticket-text-area');
                    textArea.classList.remove('hidden');
                    textArea.focus();
                    textArea.select();
                    document.execCommand('copy');
                }
                statusP.textContent = currentLanguage === 'kh'
                    ? 'បាន កូពី សូម Past ក្នុង Telegram ឬ Messenger។'
                    : 'Order summary copied. Paste it in Telegram or Messenger.';
                return true;
            } catch (err) {
                console.error('Unable to copy order summary:', err);
                statusP.textContent = currentLanguage === 'kh'
                    ? 'មិនអាចកូពី ដោយស្វ័យប្រវត្តិ។ សូមជ្រើស និងកូពីអត្ថបទខាងលើ'
                    : 'Automatic copy failed. Please select and copy the summary above.';
                return false;
            }
        };

        const sendTicketToBot = async () => {
            const statusP = document.getElementById('send-status');
            if (!statusP) return;
            const formData = getFormData('meal-order-form');
            const ticketText = generateTicketPlainText(formData);
            const encodedText = encodeURIComponent(ticketText);
            const telegramUrl = `https://t.me/${ADMIN_USERNAME}?text=${encodedText}`;

            // Copy first, so the customer can still paste the order if Telegram drops the prefilled text.
            await copyTicketSummary();
            try {
                if (isTelegramEnv && tg && typeof tg.openTelegramLink === 'function') {
                    tg.openTelegramLink(telegramUrl);
                } else {
                    window.location.assign(telegramUrl);
                }
            } catch (err) {
                console.error('Failed to open Telegram:', err);
                statusP.textContent = currentLanguage === 'kh'
                    ? 'បានចម្លងការកម្ម៉ង់។ សូមបើក Telegram ហើយបិទភ្ជាប់។'
                    : 'Order copied. Please open Telegram and paste it.';
            }
        };

        const buildOrderQrPayload = () => receipt() ? `VEARUNY ORDER\n${receipt().order.order_code}\n${receipt().order.total_amount} ${receipt().order.currency}` : '';

        const renderOrderQrCode = (orderText) => {
            const container=document.getElementById('order-qr-code');
            if(!container) return;
            container.innerHTML='';
            try {
                if(typeof QRCode!=='function') throw new Error('QRCode library unavailable');
                new QRCode(container,{text:orderText,width:230,height:230,colorDark:'#283618',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.L});
            } catch(error) {
                console.error('Unable to generate order QR:',error);
                container.textContent=currentLanguage==='kh'?'មិនអាចបង្កើត QR បានទេ':'Unable to generate QR';
            }
        };

        const updateTicketControlLanguage = () => {
            const isKh=currentLanguage==='kh';
            const card=document.getElementById('ticket-card');
            const flipped=card && card.classList.contains('is-flipped');
            const hint=document.getElementById('ticket-swipe-hint');
            const copy=document.getElementById('copy-ticket-btn');
            const download=document.getElementById('download-qr-ticket-btn');
            const close=document.getElementById('close-ticket-modal-btn');
            if(hint) hint.textContent=flipped?(isKh?'អូសស្តាំដើម្បីមើលព័ត៌មាន':'Swipe right for details'):(isKh?'អូសឆ្វេងដើម្បីមើល QR':'Swipe left for QR');
            if(copy){copy.setAttribute('aria-label',isKh?'ចម្លងព័ត៌មានការកុម្ម៉ង់':'Copy order information');copy.title=copy.getAttribute('aria-label');}
            if(download){download.setAttribute('aria-label',isKh?'ទាញយកសំបុត្រ QR':'Download QR ticket');download.title=download.getAttribute('aria-label');}
            if(close){close.setAttribute('aria-label',isKh?'បិទ':'Close');close.title=close.getAttribute('aria-label');}
        };

        const setTicketSide = (showQr) => {
            const card=document.getElementById('ticket-card');
            const download=document.getElementById('download-qr-ticket-btn');
            if(!card) return;
            card.classList.toggle('is-flipped',showQr);
            if(download) download.classList.toggle('hidden',!showQr);
            document.querySelectorAll('#ticket-side-indicator .ticket-side-dot').forEach((dot,index)=>dot.classList.toggle('is-active',index===(showQr?1:0)));
            updateTicketControlLanguage();
        };

        const enableTicketSwipe = () => {
            const card=document.getElementById('ticket-card');
            if(!card || card.dataset.swipeReady) return;
            card.dataset.swipeReady='true';
            let startX=0,startY=0,tracking=false;
            card.addEventListener('pointerdown',event=>{startX=event.clientX;startY=event.clientY;tracking=true;card.setPointerCapture?.(event.pointerId);});
            card.addEventListener('pointerup',event=>{if(!tracking)return;tracking=false;const dx=event.clientX-startX;const dy=event.clientY-startY;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy))setTicketSide(dx<0);});
            card.addEventListener('pointercancel',()=>{tracking=false;});
            card.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();setTicketSide(true);}else if(event.key==='ArrowRight'){event.preventDefault();setTicketSide(false);}});
        };

        const downloadQrTicket = async () => {
            const card=document.getElementById('ticket-card');
            const button=document.getElementById('download-qr-ticket-btn');
            try {
                button.disabled=true;
                button.classList.add('is-loading');
                const canvas=await html2canvas(card,{scale:2,backgroundColor:null,useCORS:true});
                const link=document.createElement('a');
                link.download=`vearuny-order-qr-${Date.now()}.png`;
                link.href=canvas.toDataURL('image/png');
                link.click();
            } catch(error) {
                console.error('Unable to download QR ticket:',error);
                showAlert(currentLanguage==='kh'?'មិនអាចទាញយកបានទេ។ សូមថតអេក្រង់។':'Download failed. Please take a screenshot.');
            } finally {
                button.disabled=false;
                button.classList.remove('is-loading');
            }
        };

        const displayReceipt = () => {
            document.getElementById('ticket-card').innerHTML=generateTicketCardHTML();
            document.getElementById('ticket-text-area').value=generateTicketPlainText();
            setTicketSide(false);
            document.getElementById('ticket-modal').classList.remove('hidden');
            generateQRCodes();
            requestAnimationFrame(()=>renderOrderQrCode(`https://t.me/${ADMIN_USERNAME}?text=${encodeURIComponent(buildOrderQrPayload())}`));
            document.getElementById('send-status').textContent=receipt()?.replayed?(currentLanguage==='kh'?'បានទទួលកម្ម៉ង់ដដែលវិញ':'Existing order recovered; no duplicate created.'):'';
            refreshCheckoutState();
        };
        const handleFormSubmit = async event => {
            event.preventDefault();
            if (!checkoutClient || checkoutClient.pending) return;
            try {
                let payload;
                if (!checkoutClient.attempt || checkoutClient.attempt.rejected) {
                    if (!validateForm('meal-order-form')) return;
                    const form=getFormData('meal-order-form');
                    const quantity=Number(form.quantity);
                    if(!Number.isInteger(quantity)||quantity<1||quantity>100) throw new Error('Quantity must be 1–100');
                    const sets=getOrderedPackages(quantity).map((code,index)=>({code,addons:[...(selectedAddons.get(index)||[])].sort((a,b)=>a-b)}));
                    payload=CheckoutAPI.buildPayload(catalog,form,sets,currentLanguage);
                    if(checkoutClient.attempt?.rejected)checkoutClient.reset();
                }
                const work=checkoutClient.checkout(payload?.customer,payload?.order);
                refreshCheckoutState(); showAlert(apiText().loading);
                await work;
                showAlert(apiText().created); displayReceipt();
            } catch(error) {
                showAlert(`${apiText().error} ${error.message}${checkoutClient.attempt && !checkoutClient.attempt.rejected ? ' '+apiText().recovery : ''}`);
            } finally { refreshCheckoutState(); }
        };

        const openPolicyModal = () => {
             const modal = document.getElementById('policy-modal');
             if (modal) modal.classList.remove('hidden');
        };

        const closePolicyModal = () => {
            const modal = document.getElementById('policy-modal');
            if (modal) modal.classList.add('hidden');
        };

        const configureDownloadButtons = () => {
            const downloadPngBtn = document.getElementById('download-png-btn');
            const downloadPdfBtn = document.getElementById('download-pdf-btn');
             document.body.classList.toggle('is-mobile', isMobilePlatform);
        };

        const handleSubscriberTypeChange = () => {
            const subType = document.getElementById('subscriber_type').value;
            const subNumberField = document.getElementById('subscription_number_field');

            if (subType === 'old') {
                subNumberField.style.display = 'block';
            } else {
                subNumberField.style.display = 'none';
                document.getElementById('subscription_number').value = '';
            }
            updatePriceSummary();
        };

        function openNutritionModal() {
            const modal = document.getElementById('nutrition-modal');
            const contentDiv = document.getElementById('nutrition-content');
            const titleEl = document.getElementById('nutrition-modal-title');

            const pkg = document.getElementById('package').value;
            const lang = currentLanguage;
            const data = window.NUTRITION_DATA;

            if (!data) {
                alert("Nutrition data not loaded.");
                return;
            }

            let menuType = 'standard_menu';
            if (['D', 'E', 'F'].includes(pkg)) {
                menuType = 'premium_menu';
            }

            let juiceCalories = 0;
            let juiceSizeLabel = '';
            let hasJuice = false;

            if (['B', 'E'].includes(pkg)) {
                hasJuice = true;
                juiceCalories = data.juices.small.calories;
                juiceSizeLabel = lang === 'kh' ? data.juices.small.label_kh : data.juices.small.label_en;
            } else if (['C', 'F'].includes(pkg)) {
                hasJuice = true;
                juiceCalories = data.juices.large.calories;
                juiceSizeLabel = lang === 'kh' ? data.juices.large.label_kh : data.juices.large.label_en;
            }

            titleEl.textContent = lang === 'kh' ? data.labels.modal_title.kh : data.labels.modal_title.en;

            const labelP = lang === 'kh' ? data.labels.macro_p.kh : data.labels.macro_p.en;
            const labelC = lang === 'kh' ? data.labels.macro_c.kh : data.labels.macro_c.en;
            const labelF = lang === 'kh' ? data.labels.macro_f.kh : data.labels.macro_f.en;
            const labelCal = lang === 'kh' ? data.labels.unit_cal.kh : data.labels.unit_cal.en;
            const labelClose = lang === 'kh' ? data.labels.btn_close.kh : data.labels.btn_close.en;
            const formatGram = value => /g$/i.test(String(value).trim()) ? String(value).trim() : `${value}g`;

            const closeBtn = document.querySelector('#nutrition-modal .text-right button');
            if(closeBtn) {
                closeBtn.textContent = labelClose;
            }

            const days = data[menuType].days;
            let html = '';
            let totalCal = 0;

            const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
            dayKeys.forEach(dayKey => {
                const meal = days[dayKey];
                const mealTitle = lang === 'kh' ? meal.title_kh : meal.title_en;
                const ingredients = lang === 'kh' ? meal.ingredients_kh : meal.ingredients_en;
                const juiceDesc = lang === 'kh' ? meal.juice_kh : meal.juice_en;

                const totalMealCal = meal.calories + juiceCalories;
                totalCal += totalMealCal;

                html += `
                    <div class="nutrition-day-card">
                        <div class="flex justify-between items-start">
                            <div class="pr-2">
                                <h4 class="font-bold text-[var(--brand-text)]">${mealTitle}</h4>
                                <p class="text-xs text-[var(--brand-hint)] opacity-80 mb-1">${ingredients}</p>

                                ${hasJuice ? `
                                    <div class="flex items-start gap-1 mt-1">
                                        <span class="text-xs font-bold text-[var(--brand-accent-2)] whitespace-nowrap">+ ${juiceSizeLabel}:</span>
                                        <span class="text-xs text-[var(--brand-text)] italic">${juiceDesc}</span>
                                    </div>
                                ` : ''}
                            </div>
                            <div class="text-right whitespace-nowrap">
                                <span class="font-bold text-lg text-[var(--brand-primary)]">${totalMealCal}</span>
                                <span class="text-xs block">${labelCal}</span>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-2 mt-3 text-xs text-[var(--brand-hint)] font-mono">
                            <span class="nutrition-macro-pill">${labelP}: ${formatGram(meal.protein)}</span>
                            <span class="nutrition-macro-pill">${labelC}: ${formatGram(meal.carbs)}</span>
                            <span class="nutrition-macro-pill">${labelF}: ${formatGram(meal.fats)}</span>
                        </div>
                    </div>
                `;
            });

            const avgCal = Math.round(totalCal / 5);
            const summaryLabel = lang === 'kh' ? data.labels.total_daily.kh : data.labels.total_daily.en;

            html += `
                <div class="nutrition-summary-card flex justify-between items-center">
                    <span class="font-bold text-[var(--brand-text)]">${summaryLabel}</span>
                    <span class="font-bold text-xl text-[var(--brand-accent-2)]">~${avgCal} ${labelCal}</span>
                </div>
            `;

            contentDiv.innerHTML = html;
            modal.classList.remove('hidden');
        }

        function checkInstallPrompt() {
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
            if (isStandalone) return;

            if (sessionStorage.getItem('installPromptDismissed')) return;

            const userAgent = navigator.userAgent || navigator.vendor || window.opera;
            const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
            const isAndroid = /android/i.test(userAgent);

            if (isIOS || isAndroid) {
                showInstallModal(isIOS);
            }
        }

        function showInstallModal(isIOS) {
            const modal = document.getElementById('install-modal');
            const container = document.getElementById('install-instructions');

            if (isIOS) {
                container.innerHTML = `
                    <div class="flex items-center gap-3 mb-2">
                        <span class="text-2xl">1.</span>
                        <span>Tap the <strong>Share</strong> button below.</span>
                        <svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">2.</span>
                        <span>Select <strong>Add to Home Screen</strong>.</span>
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="flex items-center gap-3 mb-2">
                        <span class="text-2xl">1.</span>
                        <span>Tap the <strong>Menu</strong> icon (three dots).</span>
                        <span class="font-bold text-xl">⋮</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">2.</span>
                        <span>Select <strong>Add to Home Screen</strong> or <strong>Install App</strong>.</span>
                    </div>
                `;
            }

            setTimeout(() => {
                if (modal) modal.classList.remove('hidden');
            }, 2000);
        }

        function closeInstallModal() {
            document.getElementById('install-modal').classList.add('hidden');
            sessionStorage.setItem('installPromptDismissed', 'true');
        }

        function closeNutritionModal() {
            document.getElementById('nutrition-modal').classList.add('hidden');
        }

        document.addEventListener('DOMContentLoaded', () => {
            try {
                 if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
                     tg = window.Telegram.WebApp;
                     isTelegramEnv = true;
                      isMobilePlatform = tg.platform && !['tdesktop', 'macos', 'linux', 'windows', 'web', 'weba', 'unknown'].includes(tg.platform.toLowerCase());
                      tg.ready();
                      tg.expand();
                      if (tg.MainButton) {
                          tg.MainButton.hide();
                      }
                 } else {
                       isTelegramEnv = false;
                       isMobilePlatform = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                       tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : { };
                 }

                 if(isMobilePlatform) {
                     document.body.classList.add('is-mobile');
                 }

                const user = tg.initDataUnsafe?.user;
                if (user && user.first_name) {
                    const nameInput = document.getElementById('customer_name');
                    if (nameInput) {
                        nameInput.value = `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`.trim();
                    }
                }

                setLanguage('kh');
                setMinStartDate();
                initializeFriendlyControls();
                toggleMethodFields();
                updatePriceSummary();
                updatePlanNotesVisibility();
                try { checkoutClient=CheckoutAPI.createClient({storage:sessionStorage}); }
                catch { showAlert(currentLanguage==='kh'?'មិនអាចអានកម្ម៉ង់ដែលរក្សាទុកបាន។ សូមទាក់ទងផ្ទះបាយ។':'Saved checkout storage is unavailable. Restore browser storage before ordering.'); }
                document.getElementById('catalog-retry-btn').onclick=loadCatalog;
                document.getElementById('new-order-btn').onclick=()=>{checkoutClient.reset();restoredAttempt=false;document.getElementById('ticket-modal').classList.add('hidden');refreshCheckoutState();updatePriceSummary();showAlert('');};
                document.getElementById('receipt-open-btn').onclick=()=>{if(receipt())displayReceipt();};
                if(checkoutClient) {loadCatalog();if(receipt())displayReceipt();}

                ['package', 'quantity', 'start_date', 'time_slot', 'pickup_time', 'customer_name', 'phone', 'remark', 'address', 'commune', 'subscription_number'].forEach(id => {
                    const element = document.getElementById(id);
                    if (element) {
                        if (['SELECT', 'INPUT'].includes(element.tagName) && element.type !== 'text' && element.type !== 'tel' && element.type !== 'number' && element.type !== 'textarea') {
                             element.addEventListener('change', updatePriceSummary);
                        }
                        if (['INPUT', 'TEXTAREA'].includes(element.tagName) && (element.type === 'text' || element.type === 'tel' || element.type === 'number' || element.tagName === 'TEXTAREA')) {
                             element.addEventListener('input', updatePriceSummary);
                        }
                    }
                });

                 const planSelect = document.getElementById('plan_type');
                 if (planSelect) {
                     planSelect.addEventListener('change', () => {
                         updatePlanNotesVisibility();
                         updatePriceSummary();
                         refreshPackageButtonPrices();
                      });
                 }

                const districtSelect = document.getElementById('district');
                if (districtSelect) {
                    districtSelect.addEventListener('change', (e) => {
                        updateCommuneOptions(e.target.value);
                        updatePriceSummary();
                    });
                }

                document.querySelectorAll('input[name="method"]').forEach(radio => {
                     radio.addEventListener('change', () => {
                         updateMethodButtonStyles();
                         updatePriceSummary();
                     });
                });

                const packageSelect = document.getElementById('package');
                if (packageSelect) packageSelect.addEventListener('change', showMenuImage);

                const subscriberSelect = document.getElementById('subscriber_type');
                if (subscriberSelect) {
                    subscriberSelect.addEventListener('change', handleSubscriberTypeChange);
                }

                const locationBtn = document.getElementById('share-location-btn');
                if (locationBtn) locationBtn.addEventListener('click', () => {
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                            (position) => {
                                const { latitude, longitude } = position.coords;
                                const addressArea = document.getElementById('address');
                                if (addressArea) {
                                    addressArea.value = `Location Pin: (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`;
                                    updatePriceSummary();
                                }
                            },
                            (error) => {
                                showAlert(translations[currentLanguage].alert_geo_error);
                            }
                        );
                    } else {
                        showAlert(translations[currentLanguage].alert_geo_unsupported);
                    }
                });

                 const pickupLink = document.getElementById('pickup-location-link');
                if(pickupLink) pickupLink.href = PICKUP_LOCATION_LINK;

                const viewPolicyBtn = document.getElementById('view-policy-btn');
                if(viewPolicyBtn) viewPolicyBtn.addEventListener('click', openPolicyModal);

                const orderForm = document.getElementById('meal-order-form');
                if (orderForm) {
                    orderForm.addEventListener('submit', handleFormSubmit);
                }

                const closeTicketModalBtn = document.getElementById('close-ticket-modal-btn');
                if (closeTicketModalBtn) {
                    closeTicketModalBtn.addEventListener('click', () => {
                        const modal = document.getElementById('ticket-modal');
                        if (modal) modal.classList.add('hidden');
                         document.getElementById('send-status').textContent = '';
                    });
                }

                const closePolicyModalBtn = document.getElementById('close-policy-modal-btn');
                if (closePolicyModalBtn) {
                     closePolicyModalBtn.addEventListener('click', closePolicyModal);
                }

                const sendBtn = document.getElementById('send-ticket-btn');
                if (sendBtn) {
                    sendBtn.addEventListener('click', sendTicketToBot);
                }

                const copyBtn = document.getElementById('copy-ticket-btn');
                if (copyBtn) {
                    copyBtn.addEventListener('click', copyTicketSummary);
                }

                const downloadQrBtn = document.getElementById('download-qr-ticket-btn');
                if (downloadQrBtn) downloadQrBtn.addEventListener('click', downloadQrTicket);
                enableTicketSwipe();

            } catch (error) {
                console.error("Initialization error:", error);
                 showAlert("Error initializing the app. Please try again.");
            }
        });
