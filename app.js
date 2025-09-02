// FitTracker Pro - Complete Fitness PWA
class FitTrackerApp {
    constructor() {
        this.version = '2.0.0';
        this.isOnline = navigator.onLine;
        this.installPromptEvent = null;
        this.serviceWorkerRegistration = null;
        
        // Core data managers
        this.userData = new UserDataManager();
        this.workoutManager = new WorkoutManager();
        this.nutritionManager = new NutritionManager();
        this.progressManager = new ProgressManager();
        this.achievementManager = new AchievementManager();
        this.stepTracker = new StepTracker();
        
        // UI managers
        this.screenManager = new ScreenManager();
        this.modalManager = new ModalManager();
        this.toastManager = new ToastManager();
        
        // Current state
        this.currentScreen = 'dashboard';
        this.onboardingStep = 1;
        this.activeWorkout = null;
        
        this.init();
    }

    async init() {
        await this.setupPWA();
        await this.loadUserData();
        await this.initializeManagers();
        
        if (!this.userData.isOnboardingComplete()) {
            this.screenManager.showWelcome();
        } else {
            this.screenManager.showMainApp();
            await this.refreshDashboard();
        }
        
        this.setupEventListeners();
        this.startBackgroundTasks();
    }

    async setupPWA() {
        // Register service worker
        if ('serviceWorker' in navigator) {
            try {
                this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered successfully');
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }

        // Handle installation prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.installPromptEvent = e;
            this.showInstallPrompt();
        });

        // Handle online/offline status
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateOfflineStatus();
            this.syncOfflineData();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateOfflineStatus();
        });
    }

    async loadUserData() {
        await this.userData.load();
        
        // Apply saved theme
        if (this.userData.settings.theme) {
            document.body.setAttribute('data-theme', this.userData.settings.theme);
        }
    }

    async initializeManagers() {
        await this.workoutManager.init();
        await this.nutritionManager.init();
        await this.progressManager.init();
        await this.achievementManager.init();
        await this.stepTracker.init();
    }

    setupEventListeners() {
        // Install prompt
        document.getElementById('installBtn')?.addEventListener('click', () => this.installApp());
        document.getElementById('dismissInstallBtn')?.addEventListener('click', () => this.dismissInstallPrompt());

        // Welcome and onboarding
        document.getElementById('startOnboardingBtn')?.addEventListener('click', () => this.startOnboarding());
        document.getElementById('nextStepBtn')?.addEventListener('click', () => this.nextOnboardingStep());
        document.getElementById('prevStepBtn')?.addEventListener('click', () => this.prevOnboardingStep());

        // Permission requests
        document.getElementById('requestMotionBtn')?.addEventListener('click', () => this.requestMotionPermission());
        document.getElementById('requestLocationBtn')?.addEventListener('click', () => this.requestLocationPermission());
        document.getElementById('requestNotificationBtn')?.addEventListener('click', () => this.requestNotificationPermission());

        // Goal selection
        document.querySelectorAll('.goal-option').forEach(option => {
            option.addEventListener('click', () => this.selectGoal(option));
        });

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => this.switchScreen(e.currentTarget.dataset.screen));
        });

        // Quick actions
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleQuickAction(e.currentTarget.dataset.action));
        });

        // Water tracking
        document.getElementById('addWaterBtn')?.addEventListener('click', () => this.addWater());
        document.getElementById('removeWaterBtn')?.addEventListener('click', () => this.removeWater());

        // Settings
        document.getElementById('themeSelect')?.addEventListener('change', (e) => this.changeTheme(e.target.value));
        document.getElementById('unitsSelect')?.addEventListener('change', (e) => this.changeUnits(e.target.value));

        // Data management
        document.getElementById('exportDataBtn')?.addEventListener('click', () => this.exportData());
        document.getElementById('syncDataBtn')?.addEventListener('click', () => this.syncData());
        document.getElementById('resetDataBtn')?.addEventListener('click', () => this.confirmResetData());

        // Food search and logging
        document.getElementById('foodSearch')?.addEventListener('input', (e) => this.searchFood(e.target.value));
        document.getElementById('scanBarcodeBtn')?.addEventListener('click', () => this.scanBarcode());

        // Exercise search
        document.getElementById('exerciseSearch')?.addEventListener('input', (e) => this.searchExercises(e.target.value));
        document.getElementById('exerciseFilter')?.addEventListener('change', (e) => this.filterExercises(e.target.value));

        // Progress period
        document.getElementById('progressPeriod')?.addEventListener('change', (e) => this.updateProgressPeriod(e.target.value));

        // Chart tabs
        document.querySelectorAll('.chart-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchChart(e.target.dataset.chart));
        });

        // Modal management
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => this.modalManager.closeModal());
        });

        // Toast close
        document.querySelector('.toast-close')?.addEventListener('click', () => this.toastManager.hideToast());

        // Form submissions
        this.setupFormListeners();
        
        // Keyboard shortcuts
        this.setupKeyboardShortcuts();
    }

    setupFormListeners() {
        // Onboarding forms
        document.querySelectorAll('#step1 input, #step1 select').forEach(input => {
            input.addEventListener('change', () => this.validateOnboardingStep(1));
        });

        // Food quantity controls
        document.getElementById('increaseQuantity')?.addEventListener('click', () => this.adjustFoodQuantity(1));
        document.getElementById('decreaseQuantity')?.addEventListener('click', () => this.adjustFoodQuantity(-1));
        document.getElementById('foodQuantity')?.addEventListener('change', () => this.updateNutritionPreview());

        // Food logging
        document.getElementById('confirmFoodLog')?.addEventListener('click', () => this.confirmFoodLog());
        document.getElementById('cancelFoodLog')?.addEventListener('click', () => this.modalManager.closeModal());

        // Add food buttons
        document.querySelectorAll('.add-food-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mealType = e.target.closest('.meal-category').dataset.meal;
                this.openFoodSearch(mealType);
            });
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.modalManager.closeModal();
                this.toastManager.hideToast();
            }
        });
    }

    // PWA Installation
    showInstallPrompt() {
        const installPrompt = document.getElementById('installPrompt');
        if (installPrompt && this.installPromptEvent) {
            installPrompt.classList.remove('hidden');
        }
    }

    async installApp() {
        if (this.installPromptEvent) {
            this.installPromptEvent.prompt();
            const result = await this.installPromptEvent.userChoice;
            if (result.outcome === 'accepted') {
                this.toastManager.showToast('App installed successfully!', 'success');
            }
            this.installPromptEvent = null;
            this.dismissInstallPrompt();
        }
    }

    dismissInstallPrompt() {
        const installPrompt = document.getElementById('installPrompt');
        if (installPrompt) {
            installPrompt.classList.add('hidden');
        }
    }

    // Onboarding Process
    startOnboarding() {
        this.screenManager.showOnboarding();
        this.updateOnboardingProgress();
    }

    nextOnboardingStep() {
        if (this.validateOnboardingStep(this.onboardingStep)) {
            if (this.onboardingStep < 4) {
                this.onboardingStep++;
                this.showOnboardingStep();
                this.updateOnboardingProgress();
            } else {
                this.completeOnboarding();
            }
        }
    }

    prevOnboardingStep() {
        if (this.onboardingStep > 1) {
            this.onboardingStep--;
            this.showOnboardingStep();
            this.updateOnboardingProgress();
        }
    }

    showOnboardingStep() {
        document.querySelectorAll('.onboarding-step').forEach(step => step.classList.remove('active'));
        document.getElementById(`step${this.onboardingStep}`).classList.add('active');
        
        const prevBtn = document.getElementById('prevStepBtn');
        const nextBtn = document.getElementById('nextStepBtn');
        
        prevBtn.style.display = this.onboardingStep > 1 ? 'block' : 'none';
        nextBtn.textContent = this.onboardingStep === 4 ? 'Complete Setup' : 'Next';
    }

    updateOnboardingProgress() {
        const progress = (this.onboardingStep / 4) * 100;
        document.getElementById('onboardingProgress').style.width = `${progress}%`;
        document.getElementById('onboardingStep').textContent = `Step ${this.onboardingStep} of 4`;
    }

    validateOnboardingStep(step) {
        switch (step) {
            case 1:
                const name = document.getElementById('userName').value;
                const age = document.getElementById('userAge').value;
                const height = document.getElementById('userHeight').value;
                const weight = document.getElementById('userWeight').value;
                return name && age && height && weight;
            case 2:
                return document.querySelector('.goal-option.selected') !== null;
            case 3:
                return true; // Goals have defaults
            case 4:
                return true; // Permissions are optional
            default:
                return true;
        }
    }

    selectGoal(option) {
        document.querySelectorAll('.goal-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
    }

    async completeOnboarding() {
        // Save user data from onboarding
        const userData = {
            name: document.getElementById('userName').value,
            age: parseInt(document.getElementById('userAge').value),
            gender: document.getElementById('userGender').value,
            height: parseInt(document.getElementById('userHeight').value),
            weight: parseInt(document.getElementById('userWeight').value),
            goal: document.querySelector('.goal-option.selected').dataset.goal,
            activityLevel: document.getElementById('activityLevel').value,
            stepGoal: parseInt(document.getElementById('stepGoal').value),
            waterGoal: parseInt(document.getElementById('waterGoal').value),
            workoutGoal: parseInt(document.getElementById('workoutGoal').value)
        };

        await this.userData.completeOnboarding(userData);
        this.screenManager.showMainApp();
        await this.refreshDashboard();
        this.toastManager.showToast('Welcome to FitTracker Pro!', 'success');
    }

    // Permission Requests
    async requestMotionPermission() {
        try {
            if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
                const permission = await DeviceMotionEvent.requestPermission();
                if (permission === 'granted') {
                    this.stepTracker.enableMotionTracking();
                    this.updatePermissionButton('requestMotionBtn', true);
                    this.toastManager.showToast('Motion tracking enabled!', 'success');
                } else {
                    this.toastManager.showToast('Motion permission denied', 'error');
                }
            } else {
                this.stepTracker.enableMotionTracking();
                this.updatePermissionButton('requestMotionBtn', true);
                this.toastManager.showToast('Motion tracking enabled!', 'success');
            }
        } catch (error) {
            this.toastManager.showToast('Motion sensors not available', 'error');
        }
    }

    async requestLocationPermission() {
        try {
            const permission = await navigator.permissions.query({name: 'geolocation'});
            if (permission.state === 'granted' || permission.state === 'prompt') {
                navigator.geolocation.getCurrentPosition(
                    () => {
                        this.updatePermissionButton('requestLocationBtn', true);
                        this.toastManager.showToast('Location access granted!', 'success');
                    },
                    () => {
                        this.toastManager.showToast('Location permission denied', 'error');
                    }
                );
            }
        } catch (error) {
            this.toastManager.showToast('Location services not available', 'error');
        }
    }

    async requestNotificationPermission() {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                this.updatePermissionButton('requestNotificationBtn', true);
                this.toastManager.showToast('Notifications enabled!', 'success');
                
                // Show a test notification
                new Notification('FitTracker Pro', {
                    body: 'You\'ll receive helpful reminders and achievements!',
                    icon: '/icon-192.png'
                });
            } else {
                this.toastManager.showToast('Notification permission denied', 'error');
            }
        } catch (error) {
            this.toastManager.showToast('Notifications not supported', 'error');
        }
    }

    updatePermissionButton(btnId, granted) {
        const btn = document.getElementById(btnId);
        if (btn && granted) {
            btn.textContent = 'Enabled';
            btn.classList.remove('btn--primary');
            btn.classList.add('btn--secondary');
            btn.disabled = true;
        }
    }

    // Screen Management
    switchScreen(screenName) {
        this.screenManager.switchScreen(screenName);
        this.currentScreen = screenName;
        
        switch (screenName) {
            case 'dashboard':
                this.refreshDashboard();
                break;
            case 'workouts':
                this.workoutManager.refreshWorkoutScreen();
                break;
            case 'nutrition':
                this.nutritionManager.refreshNutritionScreen();
                break;
            case 'progress':
                this.progressManager.refreshProgressScreen();
                break;
            case 'profile':
                this.refreshProfileScreen();
                break;
        }
    }

    // Dashboard Functions
    async refreshDashboard() {
        this.updateGreeting();
        await this.updateDashboardStats();
        this.updateRecentActivities();
        this.updateLatestAchievements();
        this.showMotivationalQuote();
    }

    updateGreeting() {
        const hour = new Date().getHours();
        let greeting = 'Good Morning!';
        if (hour >= 12 && hour < 17) greeting = 'Good Afternoon!';
        else if (hour >= 17) greeting = 'Good Evening!';
        
        const userName = this.userData.profile.name || 'Fitness Enthusiast';
        document.getElementById('greetingText').textContent = `${greeting}, ${userName}`;
        
        const motivationTexts = [
            "Let's crush those goals today!",
            "Every step counts towards success!",
            "Make today amazing!",
            "Your fitness journey continues!",
            "Time to get moving!"
        ];
        
        const randomMotivation = motivationTexts[Math.floor(Math.random() * motivationTexts.length)];
        document.getElementById('motivationText').textContent = randomMotivation;
    }

    async updateDashboardStats() {
        const today = new Date().toISOString().split('T')[0];
        
        // Steps
        const todaySteps = this.stepTracker.getTodaySteps();
        const stepGoal = this.userData.settings.stepGoal;
        document.getElementById('todaySteps').textContent = todaySteps.toLocaleString();
        this.updateProgressBar('stepsProgress', (todaySteps / stepGoal) * 100);

        // Calories
        const consumedCalories = await this.nutritionManager.getTodayCalories();
        const calorieGoal = this.userData.settings.calorieGoal;
        document.getElementById('todayCalories').textContent = Math.round(consumedCalories);
        this.updateProgressBar('caloriesProgress', (consumedCalories / calorieGoal) * 100);

        // Workouts
        const todayWorkouts = await this.workoutManager.getTodayWorkouts();
        const workoutGoal = this.userData.settings.workoutGoal;
        document.getElementById('todayWorkouts').textContent = todayWorkouts;
        this.updateProgressBar('workoutsProgress', (todayWorkouts / workoutGoal) * 100);

        // Water
        const todayWater = this.nutritionManager.getTodayWater();
        const waterGoal = this.userData.settings.waterGoal;
        document.getElementById('todayWater').textContent = todayWater;
        this.updateProgressBar('waterProgress', (todayWater / waterGoal) * 100);
        
        // Update water visual
        this.updateWaterBottle();
    }

    updateProgressBar(elementId, percentage) {
        const progressBar = document.getElementById(elementId);
        if (progressBar) {
            progressBar.style.width = `${Math.min(percentage, 100)}%`;
        }
    }

    updateRecentActivities() {
        const activities = this.progressManager.getRecentActivities();
        const container = document.getElementById('recentActivities');
        
        if (!container) return;
        
        if (activities.length === 0) {
            container.innerHTML = '<p class="text-center text-secondary">No recent activities</p>';
            return;
        }

        container.innerHTML = activities.slice(0, 5).map(activity => `
            <div class="activity-item">
                <div class="activity-icon">${this.getActivityIcon(activity.type)}</div>
                <div class="activity-details">
                    <div class="activity-name">${activity.name}</div>
                    <div class="activity-time">${this.formatRelativeTime(activity.timestamp)}</div>
                </div>
            </div>
        `).join('');
    }

    updateLatestAchievements() {
        const achievements = this.achievementManager.getLatestUnlocked();
        const container = document.getElementById('latestAchievements');
        
        if (!container) return;
        
        container.innerHTML = achievements.slice(0, 4).map(achievement => `
            <div class="achievement-badge ${achievement.unlocked ? 'unlocked' : ''}">
                <div class="badge-icon">${achievement.icon}</div>
                <div class="badge-name">${achievement.name}</div>
            </div>
        `).join('');
    }

    showMotivationalQuote() {
        const quotes = [
            "The only bad workout is the one that didn't happen.",
            "Progress, not perfection.",
            "Your body can do it. It's your mind you need to convince.",
            "Every step forward is progress.",
            "Fitness is not about being better than someone else.",
            "The groundwork for all happiness is good health.",
            "Take care of your body. It's the only place you have to live."
        ];
        
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        // You could add a quote display element to the dashboard if needed
    }

    // Quick Actions
    async handleQuickAction(action) {
        switch (action) {
            case 'start-workout':
                this.openWorkoutSelector();
                break;
            case 'log-meal':
                this.openFoodSearch();
                break;
            case 'add-water':
                this.addWater();
                break;
            case 'track-weight':
                this.openWeightTracker();
                break;
        }
    }

    // Water Tracking
    addWater() {
        this.nutritionManager.addWater(1);
        this.updateWaterBottle();
        this.updateDashboardStats();
        this.toastManager.showToast('Water logged!', 'success');
        this.achievementManager.checkWaterAchievements();
    }

    removeWater() {
        if (this.nutritionManager.getTodayWater() > 0) {
            this.nutritionManager.removeWater(1);
            this.updateWaterBottle();
            this.updateDashboardStats();
        }
    }

    updateWaterBottle() {
        const todayWater = this.nutritionManager.getTodayWater();
        const waterGoal = this.userData.settings.waterGoal;
        const percentage = (todayWater / waterGoal) * 100;
        
        const waterLevel = document.getElementById('waterLevel');
        const waterAmount = document.getElementById('waterAmount');
        
        if (waterLevel) {
            waterLevel.style.height = `${Math.min(percentage, 100)}%`;
        }
        
        if (waterAmount) {
            waterAmount.textContent = `${todayWater}/${waterGoal} glasses`;
        }
    }

    // Food Logging
    openFoodSearch(mealType = 'breakfast') {
        this.modalManager.openModal('foodModal');
        document.getElementById('mealCategory').value = mealType;
        this.currentFoodSearch = { mealType, selectedFood: null };
    }

    searchFood(query) {
        if (query.length < 2) {
            document.getElementById('foodSuggestions').innerHTML = '';
            return;
        }

        const suggestions = this.nutritionManager.searchFoods(query);
        const container = document.getElementById('foodSuggestions');
        
        container.innerHTML = suggestions.slice(0, 8).map(food => `
            <div class="food-suggestion" data-food-id="${food.id}">
                ${food.name} (${food.calories} cal)
            </div>
        `).join('');

        // Add click listeners to suggestions
        container.querySelectorAll('.food-suggestion').forEach(suggestion => {
            suggestion.addEventListener('click', () => {
                const foodId = suggestion.dataset.foodId;
                this.selectFood(foodId);
            });
        });
    }

    selectFood(foodId) {
        const food = this.nutritionManager.getFoodById(foodId);
        if (food) {
            this.currentFoodSearch.selectedFood = food;
            document.getElementById('selectedFoodName').value = food.name;
            document.getElementById('foodQuantity').value = '1';
            this.updateNutritionPreview();
            
            // Clear search and suggestions
            document.getElementById('foodSearch').value = '';
            document.getElementById('foodSuggestions').innerHTML = '';
        }
    }

    adjustFoodQuantity(delta) {
        const quantityInput = document.getElementById('foodQuantity');
        const currentQuantity = parseFloat(quantityInput.value) || 1;
        const newQuantity = Math.max(0.1, currentQuantity + delta * 0.5);
        quantityInput.value = newQuantity.toFixed(1);
        this.updateNutritionPreview();
    }

    updateNutritionPreview() {
        const food = this.currentFoodSearch?.selectedFood;
        const quantity = parseFloat(document.getElementById('foodQuantity').value) || 1;
        
        if (!food) return;

        document.getElementById('previewCalories').textContent = Math.round(food.calories * quantity);
        document.getElementById('previewProtein').textContent = `${Math.round(food.protein * quantity)}g`;
        document.getElementById('previewCarbs').textContent = `${Math.round(food.carbs * quantity)}g`;
        document.getElementById('previewFat').textContent = `${Math.round(food.fat * quantity)}g`;
    }

    confirmFoodLog() {
        const food = this.currentFoodSearch?.selectedFood;
        const quantity = parseFloat(document.getElementById('foodQuantity').value) || 1;
        const mealType = document.getElementById('mealCategory').value;
        
        if (food) {
            this.nutritionManager.logFood(food, quantity, mealType);
            this.modalManager.closeModal();
            this.toastManager.showToast(`${food.name} logged to ${mealType}!`, 'success');
            this.updateDashboardStats();
            this.nutritionManager.refreshNutritionScreen();
            this.achievementManager.checkNutritionAchievements();
        }
    }

    scanBarcode() {
        // Simulate barcode scanning
        this.toastManager.showToast('Barcode scanner not available in this demo', 'info');
    }

    // Workout Functions
    openWorkoutSelector() {
        this.switchScreen('workouts');
    }

    // Settings
    changeTheme(themeName) {
        this.userData.updateSetting('theme', themeName);
        document.body.setAttribute('data-theme', themeName);
        this.toastManager.showToast(`Theme changed to ${themeName}`, 'success');
    }

    changeUnits(units) {
        this.userData.updateSetting('units', units);
        this.toastManager.showToast(`Units changed to ${units}`, 'success');
    }

    // Profile Screen
    refreshProfileScreen() {
        const profile = this.userData.profile;
        
        // Update profile display
        document.getElementById('profileName').textContent = profile.name || 'User';
        document.getElementById('profileGoal').textContent = this.formatGoalText(profile.goal);
        document.getElementById('userInitials').textContent = this.getUserInitials(profile.name);
        
        // Update profile stats
        document.getElementById('memberSince').textContent = this.calculateMemberDays();
        document.getElementById('totalDistance').textContent = `${this.stepTracker.getTotalDistance().toFixed(1)} km`;
        document.getElementById('totalCaloriesBurned').textContent = this.stepTracker.getTotalCaloriesBurned().toLocaleString();
        
        // Update health metrics
        this.updateHealthMetrics();
        
        // Update settings display
        document.getElementById('themeSelect').value = this.userData.settings.theme;
        document.getElementById('unitsSelect').value = this.userData.settings.units;
        document.getElementById('notificationsToggle').checked = this.userData.settings.notifications;
        document.getElementById('offlineModeToggle').checked = this.userData.settings.offlineMode;
    }

    updateHealthMetrics() {
        const profile = this.userData.profile;
        
        // Calculate BMI
        const bmi = this.calculateBMI(profile.weight, profile.height);
        document.getElementById('bmiValue').textContent = bmi.toFixed(1);
        document.getElementById('bmiStatus').textContent = this.getBMIStatus(bmi);
        
        // Calculate BMR
        const bmr = this.calculateBMR(profile.weight, profile.height, profile.age, profile.gender);
        document.getElementById('bmrValue').textContent = Math.round(bmr);
        
        // Calculate TDEE
        const tdee = this.calculateTDEE(bmr, profile.activityLevel);
        document.getElementById('tdeeValue').textContent = Math.round(tdee);
        
        // Body fat estimate (simplified)
        const bodyFat = this.estimateBodyFat(bmi, profile.age, profile.gender);
        document.getElementById('bodyFatValue').textContent = `${bodyFat.toFixed(1)}%`;
    }

    // Data Management
    async exportData() {
        const exportData = {
            profile: this.userData.profile,
            settings: this.userData.settings,
            workouts: await this.workoutManager.getAllWorkouts(),
            nutrition: await this.nutritionManager.getAllNutrition(),
            progress: await this.progressManager.getAllProgress(),
            achievements: this.achievementManager.getAllAchievements(),
            steps: this.stepTracker.getAllStepData(),
            exportDate: new Date().toISOString(),
            version: this.version
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `fittracker-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        this.toastManager.showToast('Data exported successfully!', 'success');
    }

    async syncData() {
        if (!this.isOnline) {
            this.toastManager.showToast('Cannot sync while offline', 'error');
            return;
        }

        this.showLoadingScreen();
        
        // Simulate data sync
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        this.hideLoadingScreen();
        this.toastManager.showToast('Data synced successfully!', 'success');
    }

    confirmResetData() {
        if (confirm('Are you sure you want to reset ALL data? This action cannot be undone.')) {
            this.resetAllData();
        }
    }

    resetAllData() {
        localStorage.clear();
        this.toastManager.showToast('All data has been reset', 'info');
        setTimeout(() => {
            location.reload();
        }, 2000);
    }

    // Offline Support
    updateOfflineStatus() {
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        const offlineIndicator = document.getElementById('offlineIndicator');
        
        if (this.isOnline) {
            statusIndicator?.classList.remove('offline');
            if (statusText) statusText.textContent = 'Online';
            offlineIndicator?.classList.add('hidden');
        } else {
            statusIndicator?.classList.add('offline');
            if (statusText) statusText.textContent = 'Offline';
            offlineIndicator?.classList.remove('hidden');
        }
    }

    async syncOfflineData() {
        // Sync any pending offline data when coming back online
        if (this.isOnline) {
            await this.workoutManager.syncOfflineWorkouts();
            await this.nutritionManager.syncOfflineNutrition();
            await this.progressManager.syncOfflineProgress();
        }
    }

    // Background Tasks
    startBackgroundTasks() {
        // Update dashboard every minute
        setInterval(() => {
            if (this.currentScreen === 'dashboard') {
                this.updateDashboardStats();
            }
        }, 60000);

        // Save data periodically
        setInterval(() => {
            this.userData.save();
        }, 30000);

        // Check achievements periodically
        setInterval(() => {
            this.achievementManager.checkAllAchievements();
        }, 300000); // Every 5 minutes

        // Step tracking updates
        setInterval(() => {
            this.stepTracker.updateDisplay();
        }, 1000);
    }

    // Utility Functions
    showLoadingScreen() {
        document.getElementById('loadingScreen')?.classList.remove('hidden');
    }

    hideLoadingScreen() {
        document.getElementById('loadingScreen')?.classList.add('hidden');
    }

    getActivityIcon(type) {
        const icons = {
            workout: '🏋️',
            nutrition: '🍽️',
            steps: '👣',
            water: '💧',
            weight: '⚖️',
            achievement: '🏆'
        };
        return icons[type] || '📝';
    }

    formatRelativeTime(timestamp) {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'Just now';
    }

    formatGoalText(goal) {
        const goalTexts = {
            lose_weight: 'Lose Weight',
            gain_muscle: 'Gain Muscle',
            maintain: 'Maintain Weight',
            endurance: 'Build Endurance',
            general: 'General Fitness'
        };
        return goalTexts[goal] || 'General Fitness';
    }

    getUserInitials(name) {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    }

    calculateMemberDays() {
        const joinDate = this.userData.profile.joinDate || Date.now();
        return Math.floor((Date.now() - joinDate) / (1000 * 60 * 60 * 24));
    }

    calculateBMI(weight, height) {
        return weight / Math.pow(height / 100, 2);
    }

    getBMIStatus(bmi) {
        if (bmi < 18.5) return 'Underweight';
        if (bmi < 25) return 'Normal';
        if (bmi < 30) return 'Overweight';
        return 'Obese';
    }

    calculateBMR(weight, height, age, gender) {
        if (gender === 'male') {
            return 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
        } else {
            return 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
        }
    }

    calculateTDEE(bmr, activityLevel) {
        const multipliers = {
            sedentary: 1.2,
            light: 1.375,
            moderate: 1.55,
            active: 1.725,
            extra: 1.9
        };
        return bmr * (multipliers[activityLevel] || 1.2);
    }

    estimateBodyFat(bmi, age, gender) {
        // Simplified body fat estimation
        let bodyFat = (1.2 * bmi) + (0.23 * age) - 16.2;
        if (gender === 'female') bodyFat += 5.4;
        return Math.max(3, Math.min(50, bodyFat));
    }

    searchExercises(query) {
        this.workoutManager.searchExercises(query);
    }

    filterExercises(category) {
        this.workoutManager.filterExercises(category);
    }

    updateProgressPeriod(period) {
        this.progressManager.updatePeriod(period);
    }

    switchChart(chartType) {
        this.progressManager.switchChart(chartType);
    }
}

// Additional Manager Classes
class UserDataManager {
    constructor() {
        this.profile = {};
        this.settings = {
            theme: 'Ocean Blue',
            units: 'metric',
            stepGoal: 10000,
            calorieGoal: 2000,
            waterGoal: 8,
            workoutGoal: 30,
            notifications: true,
            offlineMode: true
        };
        this.onboardingComplete = false;
    }

    async load() {
        const savedProfile = localStorage.getItem('fittracker_profile');
        const savedSettings = localStorage.getItem('fittracker_settings');
        const savedOnboarding = localStorage.getItem('fittracker_onboarding');

        if (savedProfile) {
            this.profile = JSON.parse(savedProfile);
        }

        if (savedSettings) {
            this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
        }

        this.onboardingComplete = savedOnboarding === 'true';
    }

    async save() {
        localStorage.setItem('fittracker_profile', JSON.stringify(this.profile));
        localStorage.setItem('fittracker_settings', JSON.stringify(this.settings));
        localStorage.setItem('fittracker_onboarding', this.onboardingComplete.toString());
    }

    async completeOnboarding(userData) {
        this.profile = {
            ...userData,
            joinDate: Date.now(),
            id: 'user_' + Date.now()
        };
        
        this.settings = {
            ...this.settings,
            stepGoal: userData.stepGoal,
            waterGoal: userData.waterGoal,
            workoutGoal: userData.workoutGoal
        };
        
        this.onboardingComplete = true;
        await this.save();
    }

    isOnboardingComplete() {
        return this.onboardingComplete;
    }

    updateSetting(key, value) {
        this.settings[key] = value;
        this.save();
    }
}

class WorkoutManager {
    constructor() {
        this.workouts = [];
        this.activeWorkout = null;
        this.workoutTypes = [
            { id: "strength", name: "Strength Training", icon: "💪", color: "#FF6B35" },
            { id: "cardio", name: "Cardio", icon: "❤️", color: "#FF1744" },
            { id: "yoga", name: "Yoga", icon: "🧘", color: "#9C27B0" },
            { id: "hiit", name: "HIIT", icon: "⚡", color: "#FF9800" },
            { id: "running", name: "Running", icon: "🏃", color: "#4CAF50" },
            { id: "cycling", name: "Cycling", icon: "🚴", color: "#2196F3" },
            { id: "swimming", name: "Swimming", icon: "🏊", color: "#00BCD4" },
            { id: "stretching", name: "Stretching", icon: "🤸", color: "#8BC34A" }
        ];
        
        this.exercises = [
            { id: "pushups", name: "Push-ups", category: "strength", muscle: "Chest", equipment: "None" },
            { id: "squats", name: "Squats", category: "strength", muscle: "Legs", equipment: "None" },
            { id: "plank", name: "Plank", category: "strength", muscle: "Core", equipment: "None" },
            { id: "burpees", name: "Burpees", category: "hiit", muscle: "Full Body", equipment: "None" },
            { id: "jumping_jacks", name: "Jumping Jacks", category: "cardio", muscle: "Full Body", equipment: "None" },
            { id: "lunges", name: "Lunges", category: "strength", muscle: "Legs", equipment: "None" },
            { id: "mountain_climbers", name: "Mountain Climbers", category: "hiit", muscle: "Core", equipment: "None" },
            { id: "bicep_curls", name: "Bicep Curls", category: "strength", muscle: "Arms", equipment: "Dumbbells" }
        ];
    }

    async init() {
        await this.loadWorkouts();
        this.renderWorkoutCategories();
        this.renderExerciseLibrary();
    }

    async loadWorkouts() {
        const saved = localStorage.getItem('fittracker_workouts');
        if (saved) {
            this.workouts = JSON.parse(saved);
        }
    }

    async saveWorkouts() {
        localStorage.setItem('fittracker_workouts', JSON.stringify(this.workouts));
    }

    renderWorkoutCategories() {
        const container = document.getElementById('workoutCategories');
        if (!container) return;

        container.innerHTML = this.workoutTypes.map(type => `
            <div class="category-card" data-category="${type.id}">
                <div class="category-icon">${type.icon}</div>
                <div class="category-name">${type.name}</div>
                <div class="category-count">${this.getExerciseCountByCategory(type.id)} exercises</div>
            </div>
        `).join('');

        // Add click listeners
        container.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', () => {
                this.showWorkoutsByCategory(card.dataset.category);
            });
        });
    }

    renderExerciseLibrary() {
        this.displayExercises(this.exercises);
    }

    displayExercises(exercises) {
        const container = document.getElementById('exerciseList');
        if (!container) return;

        container.innerHTML = exercises.map(exercise => `
            <div class="exercise-item" data-exercise-id="${exercise.id}">
                <div class="exercise-icon">${this.getExerciseIcon(exercise.category)}</div>
                <div class="exercise-details">
                    <div class="exercise-name">${exercise.name}</div>
                    <div class="exercise-meta">${exercise.muscle} • ${exercise.equipment}</div>
                </div>
            </div>
        `).join('');

        // Add click listeners
        container.querySelectorAll('.exercise-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectExercise(item.dataset.exerciseId);
            });
        });
    }

    searchExercises(query) {
        const filtered = this.exercises.filter(exercise =>
            exercise.name.toLowerCase().includes(query.toLowerCase()) ||
            exercise.muscle.toLowerCase().includes(query.toLowerCase())
        );
        this.displayExercises(filtered);
    }

    filterExercises(category) {
        if (category === 'all') {
            this.displayExercises(this.exercises);
        } else {
            const filtered = this.exercises.filter(exercise => exercise.category === category);
            this.displayExercises(filtered);
        }
    }

    getExerciseCountByCategory(category) {
        return this.exercises.filter(ex => ex.category === category).length;
    }

    getExerciseIcon(category) {
        const icons = {
            strength: '💪',
            cardio: '❤️',
            hiit: '⚡',
            yoga: '🧘',
            running: '🏃',
            cycling: '🚴',
            swimming: '🏊',
            stretching: '🤸'
        };
        return icons[category] || '💪';
    }

    selectExercise(exerciseId) {
        const exercise = this.exercises.find(ex => ex.id === exerciseId);
        if (exercise) {
            // Show exercise details or start workout
            console.log('Selected exercise:', exercise);
        }
    }

    showWorkoutsByCategory(category) {
        // Filter exercises by category and show them
        this.filterExercises(category);
    }

    async getTodayWorkouts() {
        const today = new Date().toISOString().split('T')[0];
        return this.workouts.filter(workout => workout.date === today).length;
    }

    refreshWorkoutScreen() {
        this.renderWorkoutCategories();
        this.renderExerciseLibrary();
    }

    async getAllWorkouts() {
        return this.workouts;
    }

    async syncOfflineWorkouts() {
        // Sync offline workouts when back online
        console.log('Syncing offline workouts...');
    }
}

class NutritionManager {
    constructor() {
        this.foodDatabase = [
            { id: "apple", name: "Apple", category: "fruits", calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
            { id: "banana", name: "Banana", category: "fruits", calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
            { id: "chicken_breast", name: "Chicken Breast (100g)", category: "proteins", calories: 165, protein: 31, carbs: 0, fat: 3.6 },
            { id: "brown_rice", name: "Brown Rice (1 cup)", category: "grains", calories: 216, protein: 5, carbs: 45, fat: 1.8 },
            { id: "broccoli", name: "Broccoli (1 cup)", category: "vegetables", calories: 25, protein: 3, carbs: 5, fat: 0.3 },
            { id: "salmon", name: "Salmon (100g)", category: "proteins", calories: 208, protein: 25, carbs: 0, fat: 12 },
            { id: "greek_yogurt", name: "Greek Yogurt (1 cup)", category: "dairy", calories: 100, protein: 17, carbs: 6, fat: 0 }
        ];
        
        this.nutritionLog = [];
        this.waterLog = [];
    }

    async init() {
        await this.loadNutritionData();
    }

    async loadNutritionData() {
        const savedNutrition = localStorage.getItem('fittracker_nutrition');
        const savedWater = localStorage.getItem('fittracker_water');

        if (savedNutrition) {
            this.nutritionLog = JSON.parse(savedNutrition);
        }

        if (savedWater) {
            this.waterLog = JSON.parse(savedWater);
        }
    }

    async saveNutritionData() {
        localStorage.setItem('fittracker_nutrition', JSON.stringify(this.nutritionLog));
        localStorage.setItem('fittracker_water', JSON.stringify(this.waterLog));
    }

    searchFoods(query) {
        return this.foodDatabase.filter(food =>
            food.name.toLowerCase().includes(query.toLowerCase())
        );
    }

    getFoodById(id) {
        return this.foodDatabase.find(food => food.id === id);
    }

    logFood(food, quantity, mealType) {
        const entry = {
            id: Date.now(),
            food: { ...food },
            quantity,
            mealType,
            timestamp: Date.now(),
            date: new Date().toISOString().split('T')[0]
        };

        this.nutritionLog.push(entry);
        this.saveNutritionData();
    }

    addWater(glasses = 1) {
        const entry = {
            id: Date.now(),
            glasses,
            timestamp: Date.now(),
            date: new Date().toISOString().split('T')[0]
        };

        this.waterLog.push(entry);
        this.saveNutritionData();
    }

    removeWater(glasses = 1) {
        const today = new Date().toISOString().split('T')[0];
        const todayEntries = this.waterLog.filter(entry => entry.date === today);
        
        if (todayEntries.length > 0) {
            const lastEntry = todayEntries[todayEntries.length - 1];
            if (lastEntry.glasses > glasses) {
                lastEntry.glasses -= glasses;
            } else {
                this.waterLog = this.waterLog.filter(entry => entry.id !== lastEntry.id);
            }
            this.saveNutritionData();
        }
    }

    async getTodayCalories() {
        const today = new Date().toISOString().split('T')[0];
        return this.nutritionLog
            .filter(entry => entry.date === today)
            .reduce((total, entry) => total + (entry.food.calories * entry.quantity), 0);
    }

    getTodayWater() {
        const today = new Date().toISOString().split('T')[0];
        return this.waterLog
            .filter(entry => entry.date === today)
            .reduce((total, entry) => total + entry.glasses, 0);
    }

    refreshNutritionScreen() {
        this.updateNutritionSummary();
        this.updateMealCategories();
    }

    updateNutritionSummary() {
        // Update the nutrition summary display
        this.getTodayCalories().then(calories => {
            document.getElementById('caloriesConsumed').textContent = Math.round(calories);
        });
    }

    updateMealCategories() {
        // Update meal category displays
        const today = new Date().toISOString().split('T')[0];
        const todayEntries = this.nutritionLog.filter(entry => entry.date === today);

        ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(mealType => {
            const mealEntries = todayEntries.filter(entry => entry.mealType === mealType);
            const calories = mealEntries.reduce((total, entry) => total + (entry.food.calories * entry.quantity), 0);
            
            const caloriesElement = document.getElementById(`${mealType}Calories`);
            if (caloriesElement) {
                caloriesElement.textContent = `${Math.round(calories)} cal`;
            }

            const itemsContainer = document.getElementById(`${mealType}Items`);
            if (itemsContainer) {
                if (mealEntries.length === 0) {
                    itemsContainer.innerHTML = '<button class="add-food-btn">+ Add Food</button>';
                } else {
                    const itemsHTML = mealEntries.map(entry => `
                        <div class="food-item">
                            <span class="food-name">${entry.food.name} (${entry.quantity}x)</span>
                            <span class="food-calories">${Math.round(entry.food.calories * entry.quantity)} cal</span>
                        </div>
                    `).join('');
                    itemsContainer.innerHTML = itemsHTML + '<button class="add-food-btn">+ Add Food</button>';
                }
                
                // Re-add click listeners to add food buttons
                const addBtn = itemsContainer.querySelector('.add-food-btn');
                if (addBtn) {
                    addBtn.addEventListener('click', () => {
                        window.fitTrackerApp.openFoodSearch(mealType);
                    });
                }
            }
        });
    }

    async getAllNutrition() {
        return {
            nutritionLog: this.nutritionLog,
            waterLog: this.waterLog
        };
    }

    async syncOfflineNutrition() {
        // Sync offline nutrition when back online
        console.log('Syncing offline nutrition...');
    }
}

class ProgressManager {
    constructor() {
        this.progressData = [];
        this.measurements = [];
        this.photos = [];
    }

    async init() {
        await this.loadProgressData();
    }

    async loadProgressData() {
        const savedProgress = localStorage.getItem('fittracker_progress');
        const savedMeasurements = localStorage.getItem('fittracker_measurements');
        const savedPhotos = localStorage.getItem('fittracker_photos');

        if (savedProgress) {
            this.progressData = JSON.parse(savedProgress);
        }

        if (savedMeasurements) {
            this.measurements = JSON.parse(savedMeasurements);
        }

        if (savedPhotos) {
            this.photos = JSON.parse(savedPhotos);
        }
    }

    async saveProgressData() {
        localStorage.setItem('fittracker_progress', JSON.stringify(this.progressData));
        localStorage.setItem('fittracker_measurements', JSON.stringify(this.measurements));
        localStorage.setItem('fittracker_photos', JSON.stringify(this.photos));
    }

    getRecentActivities() {
        // Return recent activities from various sources
        return this.progressData
            .slice(-10)
            .reverse();
    }

    refreshProgressScreen() {
        this.updateProgressCharts();
        this.updateMeasurements();
    }

    updateProgressCharts() {
        // Update progress charts
        const canvas = document.getElementById('progressChart');
        if (canvas && window.Chart) {
            // Implementation would create Chart.js charts here
            console.log('Updating progress charts...');
        }
    }

    updateMeasurements() {
        // Update measurements display
        if (this.measurements.length > 0) {
            const latest = this.measurements[this.measurements.length - 1];
            document.getElementById('latestWeight').textContent = `${latest.weight} kg`;
            if (latest.bodyFat) {
                document.getElementById('latestBodyFat').textContent = `${latest.bodyFat}%`;
            }
        }
    }

    updatePeriod(period) {
        // Update charts based on selected period
        console.log('Updating period to:', period);
    }

    switchChart(chartType) {
        // Switch between different chart types
        document.querySelectorAll('.chart-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelector(`[data-chart="${chartType}"]`).classList.add('active');
        console.log('Switching to chart:', chartType);
    }

    async getAllProgress() {
        return {
            progressData: this.progressData,
            measurements: this.measurements,
            photos: this.photos
        };
    }

    async syncOfflineProgress() {
        // Sync offline progress when back online
        console.log('Syncing offline progress...');
    }
}

class AchievementManager {
    constructor() {
        this.achievements = [
            { id: "first_workout", name: "First Steps", description: "Complete your first workout", icon: "🎯", threshold: 1, unlocked: false, type: "workout" },
            { id: "week_streak", name: "Week Warrior", description: "Work out 7 days in a row", icon: "🔥", threshold: 7, unlocked: false, type: "streak" },
            { id: "calorie_goal", name: "Nutrition Master", description: "Hit your calorie goal for 3 days", icon: "🎊", threshold: 3, unlocked: false, type: "nutrition" },
            { id: "step_master", name: "Step Master", description: "Walk 10,000 steps in a day", icon: "👣", threshold: 10000, unlocked: false, type: "steps" },
            { id: "water_hero", name: "Hydration Hero", description: "Drink 8 glasses of water in a day", icon: "💧", threshold: 8, unlocked: false, type: "water" },
            { id: "workout_variety", name: "Variety Champion", description: "Try 5 different workout types", icon: "🌟", threshold: 5, unlocked: false, type: "variety" }
        ];
    }

    async init() {
        await this.loadAchievements();
        this.renderAchievements();
    }

    async loadAchievements() {
        const saved = localStorage.getItem('fittracker_achievements');
        if (saved) {
            const savedAchievements = JSON.parse(saved);
            this.achievements = this.achievements.map(achievement => {
                const saved = savedAchievements.find(s => s.id === achievement.id);
                return saved ? { ...achievement, unlocked: saved.unlocked } : achievement;
            });
        }
    }

    async saveAchievements() {
        localStorage.setItem('fittracker_achievements', JSON.stringify(this.achievements));
    }

    renderAchievements() {
        const container = document.getElementById('achievementsGrid');
        if (!container) return;

        container.innerHTML = this.achievements.map(achievement => `
            <div class="achievement-item ${achievement.unlocked ? 'unlocked' : ''}">
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-name">${achievement.name}</div>
                <div class="achievement-progress">${achievement.unlocked ? 'Completed!' : 'In Progress'}</div>
            </div>
        `).join('');

        // Update achievement count
        const unlockedCount = this.achievements.filter(a => a.unlocked).length;
        const totalCount = this.achievements.length;
        const countElement = document.getElementById('achievementCount');
        if (countElement) {
            countElement.textContent = `${unlockedCount}/${totalCount} unlocked`;
        }
    }

    getLatestUnlocked() {
        return this.achievements.filter(a => a.unlocked).slice(-4);
    }

    checkAllAchievements() {
        this.checkWaterAchievements();
        this.checkNutritionAchievements();
        this.checkWorkoutAchievements();
        this.checkStepAchievements();
    }

    checkWaterAchievements() {
        // Check water-related achievements
        const waterAchievement = this.achievements.find(a => a.id === 'water_hero');
        if (!waterAchievement.unlocked) {
            const todayWater = window.fitTrackerApp?.nutritionManager?.getTodayWater() || 0;
            if (todayWater >= waterAchievement.threshold) {
                this.unlockAchievement(waterAchievement);
            }
        }
    }

    checkNutritionAchievements() {
        // Check nutrition-related achievements
        const nutritionAchievement = this.achievements.find(a => a.id === 'calorie_goal');
        if (!nutritionAchievement.unlocked) {
            // This would check if user hit calorie goals for 3 days
            console.log('Checking nutrition achievements...');
        }
    }

    checkWorkoutAchievements() {
        // Check workout-related achievements
        const workoutAchievement = this.achievements.find(a => a.id === 'first_workout');
        if (!workoutAchievement.unlocked) {
            // This would check if user completed first workout
            console.log('Checking workout achievements...');
        }
    }

    checkStepAchievements() {
        // Check step-related achievements
        const stepAchievement = this.achievements.find(a => a.id === 'step_master');
        if (!stepAchievement.unlocked) {
            const todaySteps = window.fitTrackerApp?.stepTracker?.getTodaySteps() || 0;
            if (todaySteps >= stepAchievement.threshold) {
                this.unlockAchievement(stepAchievement);
            }
        }
    }

    unlockAchievement(achievement) {
        achievement.unlocked = true;
        this.saveAchievements();
        this.renderAchievements();
        
        // Show celebration
        window.fitTrackerApp?.toastManager?.showToast(
            `🎉 Achievement unlocked: ${achievement.name}!`, 
            'success'
        );

        // Show notification if supported
        if (Notification.permission === 'granted') {
            new Notification('Achievement Unlocked!', {
                body: achievement.name,
                icon: '/icon-192.png'
            });
        }
    }

    getAllAchievements() {
        return this.achievements;
    }
}

class StepTracker {
    constructor() {
        this.steps = 0;
        this.isTracking = false;
        this.stepHistory = {};
        this.motionEnabled = false;
        this.lastAcceleration = { x: 0, y: 0, z: 0 };
        this.stepThreshold = 1.2;
    }

    async init() {
        await this.loadStepData();
        this.loadTodaysSteps();
    }

    async loadStepData() {
        const saved = localStorage.getItem('fittracker_steps');
        if (saved) {
            this.stepHistory = JSON.parse(saved);
        }
    }

    async saveStepData() {
        const today = new Date().toISOString().split('T')[0];
        this.stepHistory[today] = this.steps;
        localStorage.setItem('fittracker_steps', JSON.stringify(this.stepHistory));
    }

    loadTodaysSteps() {
        const today = new Date().toISOString().split('T')[0];
        this.steps = this.stepHistory[today] || 0;
    }

    enableMotionTracking() {
        if (window.DeviceMotionEvent) {
            window.addEventListener('devicemotion', (event) => {
                if (this.isTracking) {
                    this.processMotionData(event);
                }
            });
            this.motionEnabled = true;
            this.isTracking = true;
        }
    }

    processMotionData(event) {
        const acceleration = event.accelerationIncludingGravity;
        if (!acceleration || !acceleration.x) return;

        const { x, y, z } = acceleration;
        const magnitude = Math.sqrt(x * x + y * y + z * z);

        if (magnitude > this.stepThreshold) {
            const prevMagnitude = Math.sqrt(
                this.lastAcceleration.x * this.lastAcceleration.x +
                this.lastAcceleration.y * this.lastAcceleration.y +
                this.lastAcceleration.z * this.lastAcceleration.z
            );

            if (magnitude > prevMagnitude) {
                this.recordStep();
            }
        }

        this.lastAcceleration = { x, y, z };
    }

    recordStep() {
        this.steps++;
        this.saveStepData();
    }

    getTodaySteps() {
        return this.steps;
    }

    getTotalDistance() {
        const totalSteps = Object.values(this.stepHistory).reduce((sum, steps) => sum + steps, 0);
        const averageStrideLength = 0.7; // meters
        return (totalSteps * averageStrideLength) / 1000; // kilometers
    }

    getTotalCaloriesBurned() {
        const totalSteps = Object.values(this.stepHistory).reduce((sum, steps) => sum + steps, 0);
        return Math.round(totalSteps * 0.04); // Rough estimate: 0.04 calories per step
    }

    updateDisplay() {
        // This would be called by the main app to update step displays
    }

    getAllStepData() {
        return this.stepHistory;
    }
}

class ScreenManager {
    constructor() {
        this.currentScreen = null;
    }

    showWelcome() {
        this.hideAllScreens();
        document.getElementById('welcomeScreen')?.classList.remove('hidden');
    }

    showOnboarding() {
        this.hideAllScreens();
        document.getElementById('onboardingScreen')?.classList.remove('hidden');
    }

    showMainApp() {
        this.hideAllScreens();
        document.getElementById('mainApp')?.classList.remove('hidden');
        this.switchScreen('dashboard');
    }

    hideAllScreens() {
        document.getElementById('welcomeScreen')?.classList.add('hidden');
        document.getElementById('onboardingScreen')?.classList.add('hidden');
        document.getElementById('mainApp')?.classList.add('hidden');
    }

    switchScreen(screenName) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Show target screen
        document.getElementById(`${screenName}Screen`)?.classList.add('active');

        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-screen="${screenName}"]`)?.classList.add('active');

        this.currentScreen = screenName;
    }
}

class ModalManager {
    constructor() {
        this.currentModal = null;
    }

    openModal(modalId) {
        this.closeModal(); // Close any existing modal
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            this.currentModal = modalId;
        }
    }

    closeModal() {
        if (this.currentModal) {
            const modal = document.getElementById(this.currentModal);
            if (modal) {
                modal.classList.add('hidden');
            }
            this.currentModal = null;
        }
    }
}

class ToastManager {
    constructor() {
        this.toastTimeout = null;
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const messageEl = document.querySelector('.toast-message');
        
        if (toast && messageEl) {
            messageEl.textContent = message;
            toast.className = `toast ${type}`;
            
            if (this.toastTimeout) {
                clearTimeout(this.toastTimeout);
            }
            
            this.toastTimeout = setTimeout(() => {
                this.hideToast();
            }, 4000);
        }
    }

    hideToast() {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.classList.add('hidden');
        }
        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
            this.toastTimeout = null;
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.fitTrackerApp = new FitTrackerApp();
    
    // Handle page visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            window.fitTrackerApp.userData.save();
        }
    });
    
    // Handle before unload
    window.addEventListener('beforeunload', () => {
        window.fitTrackerApp.userData.save();
    });
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            // Create a simple service worker inline
            const swCode = `
                const CACHE_NAME = 'fittracker-v1';
                const urlsToCache = [
                    '/',
                    '/index.html',
                    '/style.css',
                    '/app.js',
                    'https://cdn.jsdelivr.net/npm/chart.js'
                ];

                self.addEventListener('install', (event) => {
                    event.waitUntil(
                        caches.open(CACHE_NAME)
                            .then((cache) => cache.addAll(urlsToCache))
                    );
                });

                self.addEventListener('fetch', (event) => {
                    event.respondWith(
                        caches.match(event.request)
                            .then((response) => {
                                if (response) {
                                    return response;
                                }
                                return fetch(event.request);
                            }
                        )
                    );
                });
            `;
            
            const blob = new Blob([swCode], { type: 'application/javascript' });
            const swUrl = URL.createObjectURL(blob);
            
            const registration = await navigator.serviceWorker.register(swUrl);
            console.log('ServiceWorker registration successful');
        } catch (error) {
            console.log('ServiceWorker registration failed: ', error);
        }
    });
}
