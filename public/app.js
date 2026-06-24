document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('channelsTableBody');
    const formModal = document.getElementById('formModal');
    const channelForm = document.getElementById('channelForm');
    const addBtn = document.getElementById('addBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    
    const importModal = document.getElementById('importModal');
    const importBtn = document.getElementById('importBtn');
    const importForm = document.getElementById('importForm');
    const cancelImportBtn = document.getElementById('cancelImportBtn');
    const importSubmitBtn = document.getElementById('importSubmitBtn');
    
    const deleteAllBtn = document.getElementById('deleteAllBtn');
    
    const statusToast = document.getElementById('statusToast');
    const logoutBtn = document.getElementById('logoutBtn');
    const serverSelect = document.getElementById('serverSelect');
    const addServerBtn = document.getElementById('addServerBtn');
    
    let currentServer = localStorage.getItem('tvku_current_server') || 'channels';
    
    const token = localStorage.getItem('tvku_admin_token');

    // View Navigation
    const navItems = document.querySelectorAll('.nav-item[data-target]');
    const channelsView = document.getElementById('channelsView');
    const settingsView = document.getElementById('settingsView');
    const analyticsView = document.createElement('div'); // Mock for now
    const liveChatView = document.getElementById('liveChatView');
    
    function switchView(targetId) {
        navItems.forEach(item => item.classList.remove('active'));
        const activeNav = Array.from(navItems).find(item => item.getAttribute('data-target') === targetId);
        if (activeNav) activeNav.classList.add('active');
        
        channelsView.style.display = targetId === 'channelsView' ? 'block' : 'none';
        settingsView.style.display = targetId === 'settingsView' ? 'block' : 'none';
        if (liveChatView) liveChatView.style.display = targetId === 'liveChatView' ? 'flex' : 'none';
        
        if (targetId === 'settingsView') {
            fetchSettings();
        }
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            switchView(item.getAttribute('data-target'));
        });
    });

    // Settings Logic
    const backgroundsList = document.getElementById('backgroundsList');
    const addBackgroundBtn = document.getElementById('addBackgroundBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    
    function createBackgroundInput(url = '') {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.gap = '8px';
        
        const input = document.createElement('input');
        input.type = 'url';
        input.placeholder = 'https://...';
        input.value = url;
        input.className = 'bg-input';
        input.style.flex = '1';
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-danger';
        removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        removeBtn.onclick = () => div.remove();
        
        div.appendChild(input);
        div.appendChild(removeBtn);
        return div;
    }

    function fetchSettings() {
        fetch('/api/settings', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
            backgroundsList.innerHTML = '';
            const bgs = data.backgrounds || [];
            if (bgs.length === 0) {
                backgroundsList.appendChild(createBackgroundInput());
            } else {
                bgs.forEach(url => backgroundsList.appendChild(createBackgroundInput(url)));
            }
        });
    }

    addBackgroundBtn.addEventListener('click', () => {
        backgroundsList.appendChild(createBackgroundInput());
    });

    saveSettingsBtn.addEventListener('click', () => {
        const inputs = backgroundsList.querySelectorAll('.bg-input');
        const backgrounds = Array.from(inputs).map(inp => inp.value.trim()).filter(val => val !== '');
        
        fetch('/api/settings', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ backgrounds })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast("Settings saved successfully!");
            } else {
                showToast("Failed to save settings.", true);
            }
        });
    });

    function fetchServers() {
        fetch('/api/servers', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
            if (data.servers) {
                const currentVal = currentServer;
                serverSelect.innerHTML = '';
                let hasDefault = false;
                data.servers.forEach(s => {
                    if (s === 'channels') hasDefault = true;
                    const opt = document.createElement('option');
                    opt.value = s;
                    opt.textContent = s === 'channels' ? 'Server Default' : s;
                    serverSelect.appendChild(opt);
                });
                if (!hasDefault && data.servers.length === 0) {
                    const opt = document.createElement('option');
                    opt.value = 'channels';
                    opt.textContent = 'Server Default';
                    serverSelect.appendChild(opt);
                }
                
                // If we have a newly created server, it might not be in DB yet until we add a channel, so we force add it to UI
                if (!Array.from(serverSelect.options).some(opt => opt.value === currentServer)) {
                    const opt = document.createElement('option');
                    opt.value = currentServer;
                    opt.textContent = currentServer;
                    serverSelect.appendChild(opt);
                }
                
                serverSelect.value = currentServer;
            }
        });
    }
    
    serverSelect.addEventListener('change', (e) => {
        currentServer = e.target.value;
        localStorage.setItem('tvku_current_server', currentServer);
        fetchChannels();
    });
    
    addServerBtn.addEventListener('click', () => {
        const newServer = prompt("Masukkan Nama Server Baru (misal: Server VIP):");
        if (newServer && newServer.trim() !== '') {
            currentServer = newServer.trim();
            localStorage.setItem('tvku_current_server', currentServer);
            fetchServers();
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--text-muted);">Server baru dibuat! Tambahkan channel atau import M3U.</td></tr>';
            window.channelsData = [];
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('tvku_admin_token');
        window.location.href = 'login.html';
    });

    function fetchChannels() {
        fetch(`/api/channels?server=${encodeURIComponent(currentServer)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => {
            if (res.status === 401) {
                localStorage.removeItem('tvku_admin_token');
                window.location.href = 'login.html';
                throw new Error("Unauthorized");
            }
            return res.json();
        })
        .then(channels => {
            tableBody.innerHTML = '';
            if (channels.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--text-muted);">No channels found. Import an M3U or Add one!</td></tr>';
                return;
            }
            channels.forEach(channel => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><img src="${channel.logoUrl}" class="channel-logo" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjY2NjIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTIgN2wyMCAxME0yIDE3bDIwLTEwIi8+PC9zdmc+'"></td>
                    <td style="font-weight: 600;">${channel.name}</td>
                    <td><span class="badge">${channel.category}</span></td>
                    <td style="text-align: right;">
                        <button onclick="editChannel('${channel.id}')" class="btn btn-primary" style="padding: 6px 12px; font-size: 13px; margin-right: 8px;"><i class="fa-solid fa-pen"></i> Edit</button>
                        <button onclick="deleteChannel('${channel.id}')" class="btn btn-danger" style="padding: 6px 12px; font-size: 13px;"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
            window.channelsData = channels;
        })
        .catch(err => {
            if(err.message !== "Unauthorized") {
                showToast('Failed to load channels.', 'error');
            }
        });
    }

    fetchServers();
    fetchChannels();

    // Add / Edit Channel
    addBtn.addEventListener('click', () => {
        document.getElementById('formTitle').textContent = 'Add New Channel';
        channelForm.reset();
        document.getElementById('channelId').value = '';
        formModal.classList.add('active');
    });

    cancelBtn.addEventListener('click', () => {
        formModal.classList.remove('active');
    });

    channelForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('channelId').value;
        const name = document.getElementById('name').value;
        const category = document.getElementById('category').value;
        const logoUrl = document.getElementById('logoUrl').value;
        const streamUrl = document.getElementById('streamUrl').value;
        const drmType = document.getElementById('drmType').value;
        const drmKey = document.getElementById('drmKey').value;
        const userAgent = document.getElementById('userAgent').value;
        const referer = document.getElementById('referer').value;

        const data = { name, category, logoUrl, streamUrl, drmType, drmKey, userAgent, referer, serverName: currentServer };
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/channels/${id}?server=${encodeURIComponent(currentServer)}` : `/api/channels?server=${encodeURIComponent(currentServer)}`;

        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        })
        .then(res => res.json())
        .then(resData => {
            if (resData.success) {
                showToast('Channel saved successfully!', 'success');
                formModal.classList.remove('active');
                fetchChannels();
            } else {
                showToast('Failed to save channel.', 'error');
            }
        })
        .catch(err => {
            showToast('An error occurred.', 'error');
        });
    });

    // Import
    importBtn.addEventListener('click', () => {
        importModal.classList.add('active');
    });

    cancelImportBtn.addEventListener('click', () => {
        importModal.classList.remove('active');
    });

    importForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const url = document.getElementById('importUrl').value;
        importSubmitBtn.disabled = true;
        importSubmitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importing...';

        fetch('/api/import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ m3uUrl: url, serverName: currentServer })
        })
        .then(res => res.json())
        .then(data => {
            importSubmitBtn.disabled = false;
            importSubmitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Start Import';
            if (data.success) {
                showToast(`Success! Imported ${data.count} channels.`, 'success');
                importModal.classList.remove('active');
                importForm.reset();
                fetchChannels();
                fetchServers();
            } else {
                showToast(data.error || 'Failed to import', 'error');
            }
        })
        .catch(err => {
            importSubmitBtn.disabled = false;
            importSubmitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Start Import';
            showToast('An error occurred during import.', 'error');
        });
    });

    // Delete All
    deleteAllBtn.addEventListener('click', () => {
        if (confirm('Are you ABSOLUTELY SURE you want to delete ALL channels in THIS SERVER? This action cannot be undone!')) {
            fetch(`/api/channels?server=${encodeURIComponent(currentServer)}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showToast('All channels deleted successfully.', 'success');
                    fetchChannels();
                    fetchServers();
                } else {
                    showToast('Failed to delete channels.', 'error');
                }
            })
            .catch(err => {
                showToast('An error occurred.', 'error');
            });
        }
    });

    // Global edit/delete functions
    window.editChannel = function(id) {
        const channel = window.channelsData.find(c => c.id === id);
        if (channel) {
            document.getElementById('formTitle').textContent = 'Edit Channel';
            document.getElementById('channelId').value = channel.id;
            document.getElementById('name').value = channel.name;
            document.getElementById('category').value = channel.category;
            document.getElementById('logoUrl').value = channel.logoUrl || '';
            document.getElementById('streamUrl').value = channel.streamUrl;
            document.getElementById('drmType').value = channel.drmType || '';
            document.getElementById('drmKey').value = channel.drmKey || '';
            document.getElementById('userAgent').value = channel.userAgent || '';
            document.getElementById('referer').value = channel.referer || '';
            formModal.classList.add('active');
        }
    };

    window.deleteChannel = function(id) {
        if (confirm('Are you sure you want to delete this channel?')) {
            fetch(`/api/channels/${id}?server=${encodeURIComponent(currentServer)}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showToast('Channel deleted.', 'success');
                    fetchChannels();
                } else {
                    showToast('Failed to delete channel.', 'error');
                }
            });
        }
    };

    function showToast(message, type) {
        statusToast.textContent = message;
        statusToast.className = `status-toast show ${type}`;
        setTimeout(() => {
            statusToast.classList.remove('show');
        }, 3000);
    }
});
