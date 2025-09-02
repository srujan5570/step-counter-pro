class StepTracker {
    constructor() {
        this.isTracking = false;
        this.steps = 0;
        this.lastAcceleration = { x: 0, y: 0, z: 0 };
        this.stepThreshold = 1.2;
        this.stepCooldown = 200; // milliseconds
        this.lastStepTime = 0;
        this.startTime = null;
        this.activeTime = 0;
        this.chart = null;

        // App data
        this.settings = this.loadSettings();
        this.stepHistory = this.loadStepHistory();
        this.achievements = this.loadAchievements();
        this.currentScreen = 'dashboard';

        // Motivational quotes
        this.motivationalQuotes = [
            "Every step counts towards a healthier you!",
            "Progress, not perfection!",
            "Your only competition is who you were yesterday.",
            "Walking is the best medicine.",
            "One step at a time, one day at a time.",
            "Fitness is not about being better than someone else, it's about being better than you used to be.",
            "The journey of a thousand miles begins with a single step.",
            "Consistency is the mother of mastery."
        ];

        // Achievement definitions
        this.achievementData = [
            { id: "first_step", name: "First Steps", description: "Take your first 100 steps", threshold: 100, icon: "👶" },
            { id: "milestone_1k", name: "Stepping Up", description: "Walk 1,000 steps in a day", threshold: 1000, icon: "🚶" },
            { id: "milestone_5k", name: "Half Way There", description: "Walk 5,000 steps in a day", threshold: 5000, icon: "🏃" },
            { id: "milestone_10k", name: "Daily Goal Master", description: "Reach your 10,000 step goal", threshold: 10000, icon: "🎯" },
            { id: "milestone_15k", name: "Step Champion", description: "Walk 15,000 steps in a day", threshold: 15000, icon: "🏆" },
            { id: "streak_3", name: "Three Day Streak", description: "Meet your goal for 3 consecutive days", threshold: 3, icon: "🔥", type: "streak" },
            { id: "streak_7", name: "Week Warrior", description: "Meet your goal for 7 consecutive days", threshold: 7, icon: "⚡", type: "streak" },
            { id: "streak_30", name: "Monthly Master", description: "Meet your goal for 30 consecutive days", threshold: 30, icon: "👑", type: "streak" }
        ];

        // Themes
        this.themes = [
            { name: "Ocean Blue", primary: "#0066cc", secondary: "#4d94ff" },
            { name: "Forest Green", primary: "#228B22", secondary: "#90EE90" },
            { name: "Sunset Orange", primary: "#ff6600", secondary: "#ff9966" },
            { name: "Royal Purple", primary: "#6a0dad", secondary: "#b19cd9" },
            { name: "Cherry Red", primary: "#dc143c", secondary: "#ff6b8a" },
            { name: "Golden Yellow", primary: "#ffa500", secondary: "#ffd700" }
        ];

        this.init();
    }

    init() {
        // Check if app should start automatically first
        if (this.isWelcomeComplete()) {
            this.showMainApp();
            this.enableStepDetection();
        }
        
        this.setupEventListeners();
        this.updateCurrentDate();
        this.loadTodaysSteps();
        this.updateDisplay();
        this.renderAchievements();
        this.updateSettings();
        this.showRandomQuote();
        this.applyTheme();
    }

    setupEventListeners() {
        // Welcome screen - use event delegation and multiple event types
        const requestBtn = document.getElementById('requestPermissionBtn');
        if (requestBtn) {
            requestBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showPermissionModal();
            });
            
            requestBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showPermissionModal();
            });
        }

        // Permission modal - fix the event listeners with better handling
        const grantBtn = document.getElementById('grantPermissionBtn');
        if (grantBtn) {
            const handlePermissionGrant = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Permission button clicked'); // Debug log
                this.requestDeviceMotion();
            };
            
            grantBtn.addEventListener('click', handlePermissionGrant);
            grantBtn.addEventListener('touchend', handlePermissionGrant);
            
            // Also handle keyboard events
            grantBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.requestDeviceMotion();
                }
            });
        }

        // Modal overlay click to close
        const modalOverlay = document.querySelector('.modal-overlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', () => {
                this.hidePermissionModal();
                this.markWelcomeComplete();
                this.showMainApp();
            });
        }

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const screen = e.currentTarget.dataset.screen;
                this.switchScreen(screen);
            });
            
            item.addEventListener('touchend', (e) => {
                e.preventDefault();
                const screen = e.currentTarget.dataset.screen;
                this.switchScreen(screen);
            });
        });

        // Tracking controls
        const trackingBtn = document.getElementById('trackingBtn');
        if (trackingBtn) {
            trackingBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleTracking();
            });
            
            trackingBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.toggleTracking();
            });
        }

        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.resetDailySteps();
            });
            
            resetBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.resetDailySteps();
            });
        }

        // Period selector
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.updatePeriodSelection(e.target);
                this.updateChart();
            });
        });

        // Settings event listeners
        this.setupSettingsListeners();

        // Data management
        const exportBtn = document.getElementById('exportDataBtn');
        const resetDataBtn = document.getElementById('resetDataBtn');
        
        if (exportBtn) {
            exportBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.exportData();
            });
        }
        
        if (resetDataBtn) {
            resetDataBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showResetDataConfirmation();
            });
        }
    }

    setupSettingsListeners() {
        const dailyGoalInput = document.getElementById('dailyGoalInput');
        const sensitivitySelect = document.getElementById('sensitivitySelect');
        const heightInput = document.getElementById('heightInput');
        const weightInput = document.getElementById('weightInput');
        const themeSelect = document.getElementById('themeSelect');

        if (dailyGoalInput) {
            dailyGoalInput.addEventListener('change', (e) => {
                this.settings.dailyGoal = parseInt(e.target.value);
                this.saveSettings();
                this.updateDisplay();
            });
        }

        if (sensitivitySelect) {
            sensitivitySelect.addEventListener('change', (e) => {
                this.settings.sensitivity = e.target.value;
                this.updateStepThreshold();
                this.saveSettings();
            });
        }

        if (heightInput) {
            heightInput.addEventListener('change', (e) => {
                this.settings.height = parseInt(e.target.value);
                this.saveSettings();
                this.updateDisplay();
            });
        }

        if (weightInput) {
            weightInput.addEventListener('change', (e) => {
                this.settings.weight = parseInt(e.target.value);
                this.saveSettings();
                this.updateDisplay();
            });
        }

        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                this.settings.theme = e.target.value;
                this.saveSettings();
                this.applyTheme();
            });
        }
    }

    // Device Motion & Step Detection
    async requestDeviceMotion() {
        console.log('requestDeviceMotion called'); // Debug log
        
        try {
            let permissionGranted = false;
            
            if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
                // iOS 13+ permission request
                console.log('Requesting iOS permission'); // Debug log
                const permission = await DeviceMotionEvent.requestPermission();
                permissionGranted = (permission === 'granted');
                
                if (!permissionGranted) {
                    this.showToast('Motion access denied', 'error');
                    return;
                }
            } else {
                // For browsers that don't require permission
                console.log('No permission required'); // Debug log
                permissionGranted = true;
            }
            
            if (permissionGranted) {
                console.log('Permission granted, proceeding...'); // Debug log
                this.enableStepDetection();
                
                // Force hide modal with explicit DOM manipulation
                const modal = document.getElementById('permissionModal');
                if (modal) {
                    modal.style.display = 'none';
                    modal.classList.add('hidden');
                }
                
                this.markWelcomeComplete();
                this.showMainApp();
                this.showToast('Motion access granted!', 'success');
            }
        } catch (error) {
            console.error('Error requesting device motion:', error);
            // Fallback - allow app to work without motion sensors
            const modal = document.getElementById('permissionModal');
            if (modal) {
                modal.style.display = 'none';
                modal.classList.add('hidden');
            }
            
            this.markWelcomeComplete();
            this.showMainApp();
            this.showToast('Motion sensors not available - using manual mode', 'error');
        }
    }

    enableStepDetection() {
        if (window.DeviceMotionEvent) {
            window.addEventListener('devicemotion', (event) => {
                if (this.isTracking) {
                    this.processMotionData(event);
                }
            });
        }
    }

    processMotionData(event) {
        const acceleration = event.accelerationIncludingGravity;
        if (!acceleration || !acceleration.x) return;

        const { x, y, z } = acceleration;
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        const currentTime = Date.now();

        // Step detection algorithm
        if (magnitude > this.stepThreshold && 
            currentTime - this.lastStepTime > this.stepCooldown) {
            
            const prevMagnitude = Math.sqrt(
                this.lastAcceleration.x * this.lastAcceleration.x +
                this.lastAcceleration.y * this.lastAcceleration.y +
                this.lastAcceleration.z * this.lastAcceleration.z
            );

            // Detect peak in acceleration
            if (magnitude > prevMagnitude) {
                this.recordStep();
                this.lastStepTime = currentTime;
            }
        }

        this.lastAcceleration = { x, y, z };
    }

    recordStep() {
        this.steps++;
        this.updateDisplay();
        this.checkAchievements();
        
        // Add subtle animation to step counter
        const stepCounter = document.getElementById('stepCount');
        if (stepCounter) {
            stepCounter.style.transform = 'scale(1.1)';
            setTimeout(() => {
                stepCounter.style.transform = 'scale(1)';
            }, 150);
        }
    }

    updateStepThreshold() {
        const sensitivity = this.settings.sensitivity;
        switch (sensitivity) {
            case 'low': this.stepThreshold = 1.8; break;
            case 'medium': this.stepThreshold = 1.2; break;
            case 'high': this.stepThreshold = 0.8; break;
        }
    }

    // Tracking Controls
    toggleTracking() {
        if (this.isTracking) {
            this.pauseTracking();
        } else {
            this.startTracking();
        }
    }

    startTracking() {
        this.isTracking = true;
        this.startTime = Date.now();
        this.updateTrackingButton();
        this.showToast('Step tracking started!', 'success');
    }

    pauseTracking() {
        this.isTracking = false;
        if (this.startTime) {
            this.activeTime += Date.now() - this.startTime;
        }
        this.updateTrackingButton();
        this.showToast('Step tracking paused', 'success');
    }

    updateTrackingButton() {
        const btn = document.getElementById('trackingBtn');
        if (!btn) return;
        
        if (this.isTracking) {
            btn.innerHTML = `
                <svg class="btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
                Pause Tracking
            `;
            btn.classList.remove('btn--primary');
            btn.classList.add('btn--secondary');
        } else {
            btn.innerHTML = `
                <svg class="btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Start Tracking
            `;
            btn.classList.remove('btn--secondary');
            btn.classList.add('btn--primary');
        }
    }

    resetDailySteps() {
        if (confirm('Are you sure you want to reset today\'s step count? This action cannot be undone.')) {
            this.steps = 0;
            this.activeTime = 0;
            this.startTime = null;
            this.updateDisplay();
            this.showToast('Daily steps reset!', 'success');
        }
    }

    // Display Updates
    updateDisplay() {
        // Update step count
        const stepCountEl = document.getElementById('stepCount');
        if (stepCountEl) {
            stepCountEl.textContent = this.steps.toLocaleString();
        }
        
        // Update goal progress
        const progress = Math.min((this.steps / this.settings.dailyGoal) * 100, 100);
        const goalProgressEl = document.getElementById('goalProgress');
        if (goalProgressEl) {
            goalProgressEl.textContent = `${Math.round(progress)}%`;
        }
        
        // Update progress circle
        this.updateProgressCircle(progress);
        
        // Update distance
        const distance = this.calculateDistance();
        const distanceEl = document.getElementById('distanceValue');
        if (distanceEl) {
            distanceEl.textContent = `${distance.toFixed(1)} km`;
        }
        
        // Update calories
        const calories = this.calculateCalories();
        const caloriesEl = document.getElementById('caloriesValue');
        if (caloriesEl) {
            caloriesEl.textContent = Math.round(calories);
        }
        
        // Update active time
        const activeMinutes = this.getActiveMinutes();
        const activeTimeEl = document.getElementById('activeTimeValue');
        if (activeTimeEl) {
            activeTimeEl.textContent = `${activeMinutes}m`;
        }
    }

    updateProgressCircle(progress) {
        const circle = document.getElementById('progressCircle');
        if (!circle) return;
        
        const angle = (progress / 100) * 360;
        
        // Create or update the progress visualization
        circle.style.background = `conic-gradient(var(--color-primary) ${angle}deg, var(--color-secondary) ${angle}deg)`;
    }

    calculateDistance() {
        // Average stride length based on height
        const strideLength = this.settings.height * 0.413 / 100; // meters
        return (this.steps * strideLength) / 1000; // kilometers
    }

    calculateCalories() {
        // Basic calorie calculation
        const met = 3.5; // METs for walking
        const weight = this.settings.weight;
        const timeInHours = this.getActiveMinutes() / 60;
        return met * weight * timeInHours;
    }

    getActiveMinutes() {
        let totalActiveTime = this.activeTime;
        if (this.isTracking && this.startTime) {
            totalActiveTime += Date.now() - this.startTime;
        }
        return Math.floor(totalActiveTime / (1000 * 60));
    }

    updateCurrentDate() {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        const dateEl = document.getElementById('currentDate');
        if (dateEl) {
            dateEl.textContent = now.toLocaleDateString('en-US', options);
        }
    }

    // Screen Navigation
    switchScreen(screenName) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeNavItem = document.querySelector(`[data-screen="${screenName}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }

        // Update screen content
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        const targetScreen = document.getElementById(`${screenName}Screen`);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }

        this.currentScreen = screenName;

        // Load screen-specific content
        if (screenName === 'history') {
            this.updateHistoryScreen();
        } else if (screenName === 'achievements') {
            this.updateAchievementsScreen();
        }
    }

    // History Screen
    updateHistoryScreen() {
        this.updateChart();
        this.updateHistoryStats();
    }

    updateChart() {
        const periodBtn = document.querySelector('.period-btn.active');
        const period = periodBtn ? periodBtn.dataset.period : 'week';
        const data = this.getChartData(period);
        
        const ctx = document.getElementById('stepsChart');
        if (!ctx) return;
        
        if (this.chart) {
            this.chart.destroy();
        }

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Steps',
                    data: data.values,
                    borderColor: '#1FB8CD',
                    backgroundColor: 'rgba(31, 184, 205, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#1FB8CD',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString();
                            }
                        }
                    }
                },
                elements: {
                    point: {
                        hoverRadius: 8
                    }
                }
            }
        });
    }

    getChartData(period) {
        const data = { labels: [], values: [] };
        const now = new Date();
        
        if (period === 'week') {
            for (let i = 6; i >= 0; i--) {
                const date = new Date(now);
                date.setDate(date.getDate() - i);
                const dateKey = date.toISOString().split('T')[0];
                
                data.labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
                data.values.push(this.stepHistory[dateKey] || 0);
            }
        } else if (period === 'month') {
            for (let i = 29; i >= 0; i--) {
                const date = new Date(now);
                date.setDate(date.getDate() - i);
                const dateKey = date.toISOString().split('T')[0];
                
                data.labels.push(date.getDate());
                data.values.push(this.stepHistory[dateKey] || 0);
            }
        }
        
        return data;
    }

    updateHistoryStats() {
        const avgSteps = this.calculateAverageSteps();
        const bestDay = this.getBestDay();
        const totalDistance = this.getTotalDistance();

        const avgEl = document.getElementById('avgSteps');
        const bestEl = document.getElementById('bestDay');
        const distanceEl = document.getElementById('totalDistance');

        if (avgEl) avgEl.textContent = avgSteps.toLocaleString();
        if (bestEl) bestEl.textContent = bestDay.toLocaleString();
        if (distanceEl) distanceEl.textContent = `${totalDistance.toFixed(1)} km`;
    }

    calculateAverageSteps() {
        const values = Object.values(this.stepHistory);
        if (values.length === 0) return 0;
        return Math.round(values.reduce((sum, steps) => sum + steps, 0) / values.length);
    }

    getBestDay() {
        const values = Object.values(this.stepHistory);
        return values.length > 0 ? Math.max(...values) : 0;
    }

    getTotalDistance() {
        const totalSteps = Object.values(this.stepHistory).reduce((sum, steps) => sum + steps, 0);
        const strideLength = this.settings.height * 0.413 / 100; // meters
        return (totalSteps * strideLength) / 1000; // kilometers
    }

    updatePeriodSelection(selectedBtn) {
        document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
        selectedBtn.classList.add('active');
    }

    // Achievements System
    updateAchievementsScreen() {
        this.renderAchievements();
        this.updateStreakInfo();
    }

    renderAchievements() {
        const container = document.getElementById('achievementsList');
        if (!container) return;
        
        container.innerHTML = '';

        this.achievementData.forEach(achievement => {
            const isUnlocked = this.achievements[achievement.id] || false;
            const progress = this.getAchievementProgress(achievement);
            
            const item = document.createElement('div');
            item.className = `achievement-item card ${isUnlocked ? 'unlocked' : ''}`;
            
            item.innerHTML = `
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-info">
                    <div class="achievement-name">${achievement.name}</div>
                    <div class="achievement-description">${achievement.description}</div>
                    ${!isUnlocked ? `<div class="achievement-progress">${progress}/${achievement.threshold}</div>` : ''}
                </div>
            `;
            
            container.appendChild(item);
        });
    }

    getAchievementProgress(achievement) {
        if (achievement.type === 'streak') {
            return this.getCurrentStreak();
        } else {
            return Math.min(this.steps, achievement.threshold);
        }
    }

    checkAchievements() {
        this.achievementData.forEach(achievement => {
            if (!this.achievements[achievement.id]) {
                const progress = this.getAchievementProgress(achievement);
                if (progress >= achievement.threshold) {
                    this.unlockAchievement(achievement);
                }
            }
        });
    }

    unlockAchievement(achievement) {
        this.achievements[achievement.id] = true;
        this.saveAchievements();
        this.showToast(`Achievement unlocked: ${achievement.name}!`, 'success');
        
        // Add celebration effect
        setTimeout(() => {
            this.renderAchievements();
        }, 100);
    }

    getCurrentStreak() {
        let streak = 0;
        const today = new Date();
        
        for (let i = 0; i < 365; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() - i);
            const dateKey = checkDate.toISOString().split('T')[0];
            
            const daySteps = this.stepHistory[dateKey] || 0;
            if (daySteps >= this.settings.dailyGoal) {
                streak++;
            } else {
                break;
            }
        }
        
        return streak;
    }

    updateStreakInfo() {
        const streak = this.getCurrentStreak();
        const streakText = streak > 0 ? `${streak} day streak!` : 'No streak yet';
        const streakEl = document.getElementById('currentStreak');
        if (streakEl) {
            streakEl.textContent = streakText;
        }
    }

    // Settings Management
    updateSettings() {
        const elements = {
            dailyGoalInput: this.settings.dailyGoal,
            sensitivitySelect: this.settings.sensitivity,
            heightInput: this.settings.height,
            weightInput: this.settings.weight,
            themeSelect: this.settings.theme
        };

        for (const [id, value] of Object.entries(elements)) {
            const element = document.getElementById(id);
            if (element) {
                element.value = value;
            }
        }
        
        this.updateStepThreshold();
    }

    applyTheme() {
        document.body.setAttribute('data-theme', this.settings.theme);
    }

    // Data Management
    loadTodaysSteps() {
        const today = new Date().toISOString().split('T')[0];
        this.steps = this.stepHistory[today] || 0;
    }

    saveTodaysSteps() {
        const today = new Date().toISOString().split('T')[0];
        this.stepHistory[today] = this.steps;
        localStorage.setItem('stepHistory', JSON.stringify(this.stepHistory));
    }

    loadSettings() {
        const defaultSettings = {
            dailyGoal: 10000,
            height: 170,
            weight: 70,
            strideLength: 0.7,
            theme: "Ocean Blue",
            units: "metric",
            sensitivity: "medium"
        };
        
        const saved = localStorage.getItem('settings');
        return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    }

    saveSettings() {
        localStorage.setItem('settings', JSON.stringify(this.settings));
    }

    loadStepHistory() {
        const saved = localStorage.getItem('stepHistory');
        return saved ? JSON.parse(saved) : {};
    }

    loadAchievements() {
        const saved = localStorage.getItem('achievements');
        return saved ? JSON.parse(saved) : {};
    }

    saveAchievements() {
        localStorage.setItem('achievements', JSON.stringify(this.achievements));
    }

    exportData() {
        const data = {
            settings: this.settings,
            stepHistory: this.stepHistory,
            achievements: this.achievements,
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `step-tracker-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        this.showToast('Data exported successfully!', 'success');
    }

    showResetDataConfirmation() {
        if (confirm('Are you sure you want to reset ALL data? This will delete your entire history, achievements, and settings. This action cannot be undone.')) {
            this.resetAllData();
        }
    }

    resetAllData() {
        localStorage.clear();
        location.reload();
    }

    // UI Helpers
    showMainApp() {
        const welcomeScreen = document.getElementById('welcomeScreen');
        const mainApp = document.getElementById('mainApp');
        
        if (welcomeScreen) {
            welcomeScreen.style.display = 'none';
            welcomeScreen.classList.add('hidden');
        }
        if (mainApp) {
            mainApp.style.display = 'block';
            mainApp.classList.remove('hidden');
        }
    }

    showPermissionModal() {
        const modal = document.getElementById('permissionModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.remove('hidden');
        }
    }

    hidePermissionModal() {
        const modal = document.getElementById('permissionModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.add('hidden');
        }
    }

    isWelcomeComplete() {
        return localStorage.getItem('welcomeComplete') === 'true';
    }

    markWelcomeComplete() {
        localStorage.setItem('welcomeComplete', 'true');
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const messageEl = toast ? toast.querySelector('.toast-message') : null;
        
        if (toast && messageEl) {
            messageEl.textContent = message;
            toast.className = `toast ${type}`;
            
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 3000);
        }
    }

    showRandomQuote() {
        const quote = this.motivationalQuotes[Math.floor(Math.random() * this.motivationalQuotes.length)];
        const quoteEl = document.getElementById('motivationQuote');
        if (quoteEl) {
            quoteEl.textContent = quote;
        }
    }

    // Auto-save functionality
    startAutoSave() {
        setInterval(() => {
            if (this.steps > 0) {
                this.saveTodaysSteps();
            }
        }, 30000); // Save every 30 seconds
    }

    // Lifecycle methods
    handleVisibilityChange() {
        if (document.hidden) {
            this.saveTodaysSteps();
        }
    }

    handleBeforeUnload() {
        this.saveTodaysSteps();
    }

    // Manual step increment for testing (can be triggered via browser console)
    addTestSteps(count = 10) {
        for (let i = 0; i < count; i++) {
            this.recordStep();
        }
        this.showToast(`Added ${count} test steps!`, 'success');
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new StepTracker();
    
    // Make app available globally for testing
    window.stepTrackerApp = app;
    
    // Auto-save on page visibility change
    document.addEventListener('visibilitychange', () => {
        app.handleVisibilityChange();
    });
    
    // Auto-save before page unload
    window.addEventListener('beforeunload', () => {
        app.handleBeforeUnload();
    });
    
    // Start auto-save interval
    app.startAutoSave();
    
    // Update display every second
    setInterval(() => {
        if (app.isTracking) {
            app.updateDisplay();
        }
    }, 1000);
});