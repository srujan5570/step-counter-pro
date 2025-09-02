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
        try {
            // Hide loading screen immediately if shown
            this.hideLoadingScreen();
            
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
            
            // Update offline status
            this.updateOfflineStatus();
            
        } catch (error) {
            console.error('App initialization error:', error);
            this.hideLoadingScreen();
            this.screenManager.showWelcome();
        }
    }

    async setupPWA() {
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

        // Handle installation prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.installPromptEvent = e;
            this.showInstallPrompt();
        });

        // Register service worker (non-blocking)
        if ('serviceWorker' in navigator) {
            try {
                this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered successfully');
            } catch (error) {
                console.error('Service Worker registration failed:', error);
                // Don't block app loading for SW failures
            }
        }
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
        document.querySelectorAll('.modal-close, .modal-overlay').forEach(element => {
            element.addEventListener('click', () => this.modalManager.closeModal());
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
                const mealType = e.target.closest('.meal-category')?.dataset.meal || 'breakfast';
                this.openFoodSearch(mealType);
            });
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.modalManager.closeModal();
                this.toastManager.hideToast();
                this.hideLoadingScreen();
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
        } else {
            this.toastManager.showToast('Please complete all required fields', 'error');
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
        document.getElementById(`step${this.onboardingStep}`)?.classList.add('active');
        
        const prevBtn = document.getElementById('prevStepBtn');
        const nextBtn = document.getElementById('nextStepBtn');
        
        if (prevBtn) prevBtn.style.display = this.onboardingStep > 1 ? 'block' : 'none';
        if (nextBtn) nextBtn.textContent = this.onboardingStep === 4 ? 'Complete Setup' : 'Next';
    }

    updateOnboardingProgress() {
        const progress = (this.onboardingStep / 4) * 100;
        const progressFill = document.getElementById('onboardingProgress');
        const stepText = document.getElementById('onboardingStep');
        
        if (progressFill) progressFill.style.width = `${progress}%`;
        if (stepText) stepText.textContent = `Step ${this.onboardingStep} of 4`;
    }

    validateOnboardingStep(step) {
        switch (step) {
            case 1:
                const name = document.getElementById('userName')?.value;
                const age = document.getElementById('userAge')?.value;
                const height = document.getElementById('userHeight')?.value;
                const weight = document.getElementById('userWeight')?.value;
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
        try {
            // Save user data from onboarding
            const selectedGoal = document.querySelector('.goal-option.selected');
            const userData = {
                name: document.getElementById('userName')?.value || 'User',
                age: parseInt(document.getElementById('userAge')?.value) || 25,
                gender: document.getElementById('userGender')?.value || 'male',
                height: parseInt(document.getElementById('userHeight')?.value) || 170,
                weight: parseInt(document.getElementById('userWeight')?.value) || 70,
                goal: selectedGoal?.dataset.goal || 'general',
                activityLevel: document.getElementById('activityLevel')?.value || 'moderate',
                stepGoal: parseInt(document.getElementById('stepGoal')?.value) || 10000,
                waterGoal: parseInt(document.getElementById('waterGoal')?.value) || 8,
                workoutGoal: parseInt(document.getElementById('workoutGoal')?.value) || 30
            };

            await this.userData.completeOnboarding(userData);
            this.screenManager.showMainApp();
            await this.refreshDashboard();
            this.toastManager.showToast(`Welcome to FitTracker Pro, ${userData.name}!`, 'success');
        } catch (error) {
            console.error('Onboarding completion error:', error);
            this.toastManager.showToast('Error completing setup. Please try again.', 'error');
        }
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
            console.error('Motion permission error:', error);
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
            console.error('Location permission error:', error);
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
            console.error('Notification permission error:', error);
            this.toastManager.showToast('Notifications not supported', 'error');
        }
    }

    updatePermissionButton(btnId, granted) {
        const btn = document.getElementById(btnId);
        if (btn && granted) {
            btn.textContent = '✓ Enabled';
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
        try {
            this.updateGreeting();
            await this.updateDashboardStats();
            this.updateRecentActivities();
            this.updateLatestAchievements();
            this.showMotivationalQuote();
        } catch (error) {
            console.error('Dashboard refresh error:', error);
        }
    }

    updateGreeting() {
        const hour = new Date().getHours();
        let greeting = 'Good Morning!';
        if (hour >= 12 && hour < 17) greeting = 'Good Afternoon!';
        else if (hour >= 17) greeting = 'Good Evening!';
        
        const userName = this.userData.profile.name || 'Fitness Enthusiast';
        const greetingElement = document.getElementById('greetingText');
        if (greetingElement) {
            greetingElement.textContent = `${greeting}, ${userName.split(' ')[0]}`;
        }
        
        const motivationTexts = [
            "Let's crush those goals today!",
            "Every step counts towards success!",
            "Make today amazing!",
            "Your fitness journey continues!",
            "Time to get moving!"
        ];
        
        const randomMotivation = motivationTexts[Math.floor(Math.random() * motivationTexts.length)];
        const motivationElement = document.getElementById('motivationText');
        if (motivationElement) {
            motivationElement.textContent = randomMotivation;
        }
    }

    async updateDashboardStats() {
        try {
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
            const workoutGoal = 1; // Daily workout goal
            document.getElementById('todayWorkouts').textContent = todayWorkouts;
            this.updateProgressBar('workoutsProgress', (todayWorkouts / workoutGoal) * 100);

            // Water
            const todayWater = this.nutritionManager.getTodayWater();
            const waterGoal = this.userData.settings.waterGoal;
            document.getElementById('todayWater').textContent = todayWater;
            this.updateProgressBar('waterProgress', (todayWater / waterGoal) * 100);
            
            // Update water visual
            this.updateWaterBottle();
        } catch (error) {
            console.error('Dashboard stats update error:', error);
        }
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
            container.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary); padding: var(--space-16);">No recent activities. Start your fitness journey!</p>';
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
        
        if (achievements.length === 0) {
            container.innerHTML = `
                <div class="achievement-badge">
                    <div class="badge-icon">🎯</div>
                    <div class="badge-name">Start Your Journey</div>
                </div>
                <div class="achievement-badge">
                    <div class="badge-icon">💪</div>
                    <div class="badge-name">First Workout</div>
                </div>
                <div class="achievement-badge">
                    <div class="badge-icon">💧</div>
                    <div class="badge-name">Stay Hydrated</div>
                </div>
                <div class="achievement-badge">
                    <div class="badge-icon">🏆</div>
                    <div class="badge-name">Goal Achieved</div>
                </div>
            `;
            return;
        }

        container.innerHTML = achievements.slice(0, 4).map(achievement => `
            <div class="achievement-badge ${achievement.unlocked ? 'unlocked' : ''}">
                <div class="badge-icon">${achievement.icon}</div>
                <div class="badge-name">${achievement.name}</div>
            </div>
        `).join('');
    }

    showMotivationalQuote() {
        // Could add motivational quote display if needed
    }

    // Quick Actions
    async handleQuickAction(action) {
        try {
            switch (action) {
                case 'start-workout':
                    this.switchScreen('workouts');
                    break;
                case 'log-meal':
                    this.openFoodSearch();
                    break;
                case 'add-water':
                    this.addWater();
                    break;
                case 'track-weight':
                    this.toastManager.showToast('Weight tracking coming soon!', 'info');
                    break;
            }
        } catch (error) {
            console.error('Quick action error:', error);
            this.toastManager.showToast('Action failed. Please try again.', 'error');
        }
    }

    // Water Tracking
    addWater() {
        try {
            this.nutritionManager.addWater(1);
            this.updateWaterBottle();
            this.updateDashboardStats();
            this.toastManager.showToast('Water logged! 💧', 'success');
            this.achievementManager.checkWaterAchievements();
        } catch (error) {
            console.error('Add water error:', error);
            this.toastManager.showToast('Failed to log water', 'error');
        }
    }

    removeWater() {
        try {
            if (this.nutritionManager.getTodayWater() > 0) {
                this.nutritionManager.removeWater(1);
                this.updateWaterBottle();
                this.updateDashboardStats();
                this.toastManager.showToast('Water removed', 'info');
            } else {
                this.toastManager.showToast('No water to remove', 'info');
            }
        } catch (error) {
            console.error('Remove water error:', error);
        }
    }

    updateWaterBottle() {
        const todayWater = this.nutritionManager.getTodayWater();
        const waterGoal = this.userData.settings.waterGoal;
        const percentage = Math.min((todayWater / waterGoal) * 100, 100);
        
        const waterLevel = document.getElementById('waterLevel');
        const waterAmount = document.getElementById('waterAmount');
        
        if (waterLevel) {
            waterLevel.style.height = `${percentage}%`;
        }
        
        if (waterAmount) {
            waterAmount.textContent = `${todayWater}/${waterGoal} glasses`;
        }
    }

    // Food Logging
    openFoodSearch(mealType = 'breakfast') {
        this.modalManager.openModal('foodModal');
        const mealCategorySelect = document.getElementById('mealCategory');
        if (mealCategorySelect) {
            mealCategorySelect.value = mealType;
        }
        this.currentFoodSearch = { mealType, selectedFood: null };
        
        // Clear previous search
        const foodSearch = document.getElementById('foodSearch');
        if (foodSearch) foodSearch.value = '';
        const suggestions = document.getElementById('foodSuggestions');
        if (suggestions) suggestions.innerHTML = '';
    }

    searchFood(query) {
        if (query.length < 2) {
            document.getElementById('foodSuggestions').innerHTML = '';
            return;
        }

        try {
            const suggestions = this.nutritionManager.searchFoods(query);
            const container = document.getElementById('foodSuggestions');
            
            if (container) {
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
        } catch (error) {
            console.error('Food search error:', error);
        }
    }

    selectFood(foodId) {
        try {
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
        } catch (error) {
            console.error('Select food error:', error);
        }
    }

    adjustFoodQuantity(delta) {
        try {
            const quantityInput = document.getElementById('foodQuantity');
            const currentQuantity = parseFloat(quantityInput.value) || 1;
            const newQuantity = Math.max(0.1, currentQuantity + delta * 0.5);
            quantityInput.value = newQuantity.toFixed(1);
            this.updateNutritionPreview();
        } catch (error) {
            console.error('Adjust quantity error:', error);
        }
    }

    updateNutritionPreview() {
        try {
            const food = this.currentFoodSearch?.selectedFood;
            const quantity = parseFloat(document.getElementById('foodQuantity')?.value) || 1;
            
            if (!food) return;

            document.getElementById('previewCalories').textContent = Math.round(food.calories * quantity);
            document.getElementById('previewProtein').textContent = `${Math.round(food.protein * quantity)}g`;
            document.getElementById('previewCarbs').textContent = `${Math.round(food.carbs * quantity)}g`;
            document.getElementById('previewFat').textContent = `${Math.round(food.fat * quantity)}g`;
        } catch (error) {
            console.error('Nutrition preview error:', error);
        }
    }

    confirmFoodLog() {
        try {
            const food = this.currentFoodSearch?.selectedFood;
            const quantity = parseFloat(document.getElementById('foodQuantity')?.value) || 1;
            const mealType = document.getElementById('mealCategory')?.value || 'breakfast';
            
            if (food) {
                this.nutritionManager.logFood(food, quantity, mealType);
                this.modalManager.closeModal();
                this.toastManager.showToast(`${food.name} logged to ${mealType}!`, 'success');
                this.updateDashboardStats();
                this.nutritionManager.refreshNutritionScreen();
                this.achievementManager.checkNutritionAchievements();
            } else {
                this.toastManager.showToast('Please select a food item first', 'error');
            }
        } catch (error) {
            console.error('Food log error:', error);
            this.toastManager.showToast('Failed to log food', 'error');
        }
    }

    scanBarcode() {
        this.toastManager.showToast('Barcode scanner coming soon! 📱', 'info');
    }

    // Settings
    changeTheme(themeName) {
        try {
            this.userData.updateSetting('theme', themeName);
            document.body.setAttribute('data-theme', themeName);
            this.toastManager.showToast(`Theme changed to ${themeName}`, 'success');
        } catch (error) {
            console.error('Theme change error:', error);
        }
    }

    changeUnits(units) {
        try {
            this.userData.updateSetting('units', units);
            this.toastManager.showToast(`Units changed to ${units}`, 'success');
        } catch (error) {
            console.error('Units change error:', error);
        }
    }

    // Profile Screen
    refreshProfileScreen() {
        try {
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
        } catch (error) {
            console.error('Profile refresh error:', error);
        }
    }

    updateHealthMetrics() {
        try {
            const profile = this.userData.profile;
            
            if (!profile.weight || !profile.height) return;
            
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
        } catch (error) {
            console.error('Health metrics error:', error);
        }
    }

    // Data Management
    async exportData() {
        try {
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
        } catch (error) {
            console.error('Export error:', error);
            this.toastManager.showToast('Export failed', 'error');
        }
    }

    async syncData() {
        if (!this.isOnline) {
            this.toastManager.showToast('Cannot sync while offline', 'error');
            return;
        }

        try {
            this.showLoadingScreen();
            
            // Simulate data sync
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            this.hideLoadingScreen();
            this.toastManager.showToast('Data synced successfully!', 'success');
        } catch (error) {
            console.error('Sync error:', error);
            this.hideLoadingScreen();
            this.toastManager.showToast('Sync failed', 'error');
        }
    }

    confirmResetData() {
        if (confirm('Are you sure you want to reset ALL data? This action cannot be undone.')) {
            this.resetAllData();
        }
    }

    resetAllData() {
        try {
            localStorage.clear();
            this.toastManager.showToast('All data has been reset', 'info');
            setTimeout(() => {
                location.reload();
            }, 2000);
        } catch (error) {
            console.error('Reset error:', error);
        }
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
        if (this.isOnline) {
            try {
                await this.workoutManager.syncOfflineWorkouts();
                await this.nutritionManager.syncOfflineNutrition();
                await this.progressManager.syncOfflineProgress();
            } catch (error) {
                console.error('Offline sync error:', error);
            }
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
        }, 300000);
    }

    // Utility Functions
    showLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.remove('hidden');
        }
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
        }
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
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }

    calculateMemberDays() {
        const joinDate = this.userData.profile.joinDate || Date.now();
        return Math.max(1, Math.floor((Date.now() - joinDate) / (1000 * 60 * 60 * 24)));
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
        let bodyFat = (1.2 * bmi) + (0.23 * age) - 16.2;
        if (gender === 'female') bodyFat += 5.4;
        return Math.max(3, Math.min(50, bodyFat));
    }

    // Delegation methods for manager classes
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

// Manager Classes with error handling
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
        try {
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
        } catch (error) {
            console.error('User data load error:', error);
        }
    }

    async save() {
        try {
            localStorage.setItem('fittracker_profile', JSON.stringify(this.profile));
            localStorage.setItem('fittracker_settings', JSON.stringify(this.settings));
            localStorage.setItem('fittracker_onboarding', this.onboardingComplete.toString());
        } catch (error) {
            console.error('User data save error:', error);
        }
    }

    async completeOnboarding(userData) {
        try {
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
        } catch (error) {
            console.error('Onboarding completion error:', error);
            throw error;
        }
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
        try {
            await this.loadWorkouts();
            this.renderWorkoutCategories();
            this.renderExerciseLibrary();
        } catch (error) {
            console.error('Workout manager init error:', error);
        }
    }

    async loadWorkouts() {
        try {
            const saved = localStorage.getItem('fittracker_workouts');
            if (saved) {
                this.workouts = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Workout load error:', error);
            this.workouts = [];
        }
    }

    async saveWorkouts() {
        try {
            localStorage.setItem('fittracker_workouts', JSON.stringify(this.workouts));
        } catch (error) {
            console.error('Workout save error:', error);
        }
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
            window.fitTrackerApp?.toastManager?.showToast(`Selected: ${exercise.name}`, 'info');
        }
    }

    showWorkoutsByCategory(category) {
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
            { id: "greek_yogurt", name: "Greek Yogurt (1 cup)", category: "dairy", calories: 100, protein: 17, carbs: 6, fat: 0 },
            { id: "eggs", name: "Eggs (2 large)", category: "proteins", calories: 140, protein: 12, carbs: 1, fat: 10 },
            { id: "oatmeal", name: "Oatmeal (1 cup)", category: "grains", calories: 154, protein: 6, carbs: 28, fat: 3 },
            { id: "almonds", name: "Almonds (1 oz)", category: "nuts", calories: 164, protein: 6, carbs: 6, fat: 14 }
        ];
        
        this.nutritionLog = [];
        this.waterLog = [];
    }

    async init() {
        try {
            await this.loadNutritionData();
        } catch (error) {
            console.error('Nutrition manager init error:', error);
        }
    }

    async loadNutritionData() {
        try {
            const savedNutrition = localStorage.getItem('fittracker_nutrition');
            const savedWater = localStorage.getItem('fittracker_water');

            if (savedNutrition) {
                this.nutritionLog = JSON.parse(savedNutrition);
            }

            if (savedWater) {
                this.waterLog = JSON.parse(savedWater);
            }
        } catch (error) {
            console.error('Nutrition data load error:', error);
            this.nutritionLog = [];
            this.waterLog = [];
        }
    }

    async saveNutritionData() {
        try {
            localStorage.setItem('fittracker_nutrition', JSON.stringify(this.nutritionLog));
            localStorage.setItem('fittracker_water', JSON.stringify(this.waterLog));
        } catch (error) {
            console.error('Nutrition data save error:', error);
        }
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
        try {
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
        } catch (error) {
            console.error('Food log error:', error);
        }
    }

    addWater(glasses = 1) {
        try {
            const entry = {
                id: Date.now(),
                glasses,
                timestamp: Date.now(),
                date: new Date().toISOString().split('T')[0]
            };

            this.waterLog.push(entry);
            this.saveNutritionData();
        } catch (error) {
            console.error('Add water error:', error);
        }
    }

    removeWater(glasses = 1) {
        try {
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
        } catch (error) {
            console.error('Remove water error:', error);
        }
    }

    async getTodayCalories() {
        try {
            const today = new Date().toISOString().split('T')[0];
            return this.nutritionLog
                .filter(entry => entry.date === today)
                .reduce((total, entry) => total + (entry.food.calories * entry.quantity), 0);
        } catch (error) {
            console.error('Today calories error:', error);
            return 0;
        }
    }

    getTodayWater() {
        try {
            const today = new Date().toISOString().split('T')[0];
            return this.waterLog
                .filter(entry => entry.date === today)
                .reduce((total, entry) => total + entry.glasses, 0);
        } catch (error) {
            console.error('Today water error:', error);
            return 0;
        }
    }

    refreshNutritionScreen() {
        try {
            this.updateNutritionSummary();
            this.updateMealCategories();
        } catch (error) {
            console.error('Nutrition screen refresh error:', error);
        }
    }

    updateNutritionSummary() {
        this.getTodayCalories().then(calories => {
            const element = document.getElementById('caloriesConsumed');
            if (element) {
                element.textContent = Math.round(calories);
            }
        });
    }

    updateMealCategories() {
        try {
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
        } catch (error) {
            console.error('Meal categories update error:', error);
        }
    }

    async getAllNutrition() {
        return {
            nutritionLog: this.nutritionLog,
            waterLog: this.waterLog
        };
    }

    async syncOfflineNutrition() {
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
        try {
            await this.loadProgressData();
        } catch (error) {
            console.error('Progress manager init error:', error);
        }
    }

    async loadProgressData() {
        try {
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
        } catch (error) {
            console.error('Progress data load error:', error);
            this.progressData = [];
            this.measurements = [];
            this.photos = [];
        }
    }

    async saveProgressData() {
        try {
            localStorage.setItem('fittracker_progress', JSON.stringify(this.progressData));
            localStorage.setItem('fittracker_measurements', JSON.stringify(this.measurements));
            localStorage.setItem('fittracker_photos', JSON.stringify(this.photos));
        } catch (error) {
            console.error('Progress data save error:', error);
        }
    }

    getRecentActivities() {
        // Generate some sample activities for demonstration
        const sampleActivities = [
            { type: 'water', name: 'Drank 8 glasses of water', timestamp: Date.now() - 1000 * 60 * 30 },
            { type: 'steps', name: 'Walked 2,500 steps', timestamp: Date.now() - 1000 * 60 * 60 * 2 },
            { type: 'nutrition', name: 'Logged breakfast', timestamp: Date.now() - 1000 * 60 * 60 * 4 }
        ];

        return [...this.progressData, ...sampleActivities]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 10);
    }

    refreshProgressScreen() {
        try {
            this.updateProgressCharts();
            this.updateMeasurements();
        } catch (error) {
            console.error('Progress screen refresh error:', error);
        }
    }

    updateProgressCharts() {
        // Chart implementation would go here
        console.log('Updating progress charts...');
    }

    updateMeasurements() {
        try {
            if (this.measurements.length > 0) {
                const latest = this.measurements[this.measurements.length - 1];
                const weightElement = document.getElementById('latestWeight');
                const bodyFatElement = document.getElementById('latestBodyFat');
                
                if (weightElement) weightElement.textContent = `${latest.weight} kg`;
                if (bodyFatElement && latest.bodyFat) {
                    bodyFatElement.textContent = `${latest.bodyFat}%`;
                }
            }
        } catch (error) {
            console.error('Measurements update error:', error);
        }
    }

    updatePeriod(period) {
        console.log('Updating period to:', period);
    }

    switchChart(chartType) {
        try {
            document.querySelectorAll('.chart-tab').forEach(tab => tab.classList.remove('active'));
            const activeTab = document.querySelector(`[data-chart="${chartType}"]`);
            if (activeTab) {
                activeTab.classList.add('active');
            }
            console.log('Switching to chart:', chartType);
        } catch (error) {
            console.error('Chart switch error:', error);
        }
    }

    async getAllProgress() {
        return {
            progressData: this.progressData,
            measurements: this.measurements,
            photos: this.photos
        };
    }

    async syncOfflineProgress() {
        console.log('Syncing offline progress...');
    }
}

class AchievementManager {
    constructor() {
        this.achievements = [
            { id: "first_steps", name: "First Steps", description: "Welcome to FitTracker!", icon: "🎯", threshold: 1, unlocked: false, type: "welcome" },
            { id: "hydration_hero", name: "Hydration Hero", description: "Drink 8 glasses of water in a day", icon: "💧", threshold: 8, unlocked: false, type: "water" },
            { id: "step_master", name: "Step Master", description: "Walk 10,000 steps in a day", icon: "👣", threshold: 10000, unlocked: false, type: "steps" },
            { id: "nutrition_tracker", name: "Nutrition Tracker", description: "Log your first meal", icon: "🍽️", threshold: 1, unlocked: false, type: "nutrition" },
            { id: "week_warrior", name: "Week Warrior", description: "Stay active for 7 days", icon: "🔥", threshold: 7, unlocked: false, type: "streak" },
            { id: "goal_crusher", name: "Goal Crusher", description: "Hit all daily goals", icon: "🏆", threshold: 1, unlocked: false, type: "goals" }
        ];
    }

    async init() {
        try {
            await this.loadAchievements();
            this.renderAchievements();
        } catch (error) {
            console.error('Achievement manager init error:', error);
        }
    }

    async loadAchievements() {
        try {
            const saved = localStorage.getItem('fittracker_achievements');
            if (saved) {
                const savedAchievements = JSON.parse(saved);
                this.achievements = this.achievements.map(achievement => {
                    const saved = savedAchievements.find(s => s.id === achievement.id);
                    return saved ? { ...achievement, unlocked: saved.unlocked } : achievement;
                });
            }
        } catch (error) {
            console.error('Achievements load error:', error);
        }
    }

    async saveAchievements() {
        try {
            localStorage.setItem('fittracker_achievements', JSON.stringify(this.achievements));
        } catch (error) {
            console.error('Achievements save error:', error);
        }
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
        this.checkWelcomeAchievement();
    }

    checkWelcomeAchievement() {
        const welcomeAchievement = this.achievements.find(a => a.id === 'first_steps');
        if (!welcomeAchievement.unlocked && window.fitTrackerApp?.userData?.isOnboardingComplete()) {
            this.unlockAchievement(welcomeAchievement);
        }
    }

    checkWaterAchievements() {
        const waterAchievement = this.achievements.find(a => a.id === 'hydration_hero');
        if (!waterAchievement.unlocked) {
            const todayWater = window.fitTrackerApp?.nutritionManager?.getTodayWater() || 0;
            if (todayWater >= waterAchievement.threshold) {
                this.unlockAchievement(waterAchievement);
            }
        }
    }

    checkNutritionAchievements() {
        const nutritionAchievement = this.achievements.find(a => a.id === 'nutrition_tracker');
        if (!nutritionAchievement.unlocked) {
            const nutritionLog = window.fitTrackerApp?.nutritionManager?.nutritionLog || [];
            if (nutritionLog.length > 0) {
                this.unlockAchievement(nutritionAchievement);
            }
        }
    }

    unlockAchievement(achievement) {
        try {
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
        } catch (error) {
            console.error('Achievement unlock error:', error);
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
        try {
            await this.loadStepData();
            this.loadTodaysSteps();
        } catch (error) {
            console.error('Step tracker init error:', error);
        }
    }

    async loadStepData() {
        try {
            const saved = localStorage.getItem('fittracker_steps');
            if (saved) {
                this.stepHistory = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Step data load error:', error);
            this.stepHistory = {};
        }
    }

    async saveStepData() {
        try {
            const today = new Date().toISOString().split('T')[0];
            this.stepHistory[today] = this.steps;
            localStorage.setItem('fittracker_steps', JSON.stringify(this.stepHistory));
        } catch (error) {
            console.error('Step data save error:', error);
        }
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
        try {
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
        } catch (error) {
            console.error('Motion processing error:', error);
        }
    }

    recordStep() {
        try {
            this.steps++;
            this.saveStepData();
        } catch (error) {
            console.error('Step record error:', error);
        }
    }

    getTodaySteps() {
        return this.steps;
    }

    getTotalDistance() {
        try {
            const totalSteps = Object.values(this.stepHistory).reduce((sum, steps) => sum + steps, 0);
            const averageStrideLength = 0.7; // meters
            return (totalSteps * averageStrideLength) / 1000; // kilometers
        } catch (error) {
            console.error('Distance calculation error:', error);
            return 0;
        }
    }

    getTotalCaloriesBurned() {
        try {
            const totalSteps = Object.values(this.stepHistory).reduce((sum, steps) => sum + steps, 0);
            return Math.round(totalSteps * 0.04); // Rough estimate: 0.04 calories per step
        } catch (error) {
            console.error('Calories calculation error:', error);
            return 0;
        }
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
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (welcomeScreen) {
            welcomeScreen.classList.remove('hidden');
        }
    }

    showOnboarding() {
        this.hideAllScreens();
        const onboardingScreen = document.getElementById('onboardingScreen');
        if (onboardingScreen) {
            onboardingScreen.classList.remove('hidden');
        }
    }

    showMainApp() {
        this.hideAllScreens();
        const mainApp = document.getElementById('mainApp');
        if (mainApp) {
            mainApp.classList.remove('hidden');
        }
        this.switchScreen('dashboard');
    }

    hideAllScreens() {
        const screens = ['welcomeScreen', 'onboardingScreen', 'mainApp'];
        screens.forEach(screenId => {
            const screen = document.getElementById(screenId);
            if (screen) {
                screen.classList.add('hidden');
            }
        });
    }

    switchScreen(screenName) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Show target screen
        const targetScreen = document.getElementById(`${screenName}Screen`);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }

        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        const navItem = document.querySelector(`[data-screen="${screenName}"]`);
        if (navItem) {
            navItem.classList.add('active');
        }

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
        try {
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
        } catch (error) {
            console.error('Toast show error:', error);
        }
    }

    hideToast() {
        try {
            const toast = document.getElementById('toast');
            if (toast) {
                toast.classList.add('hidden');
            }
            if (this.toastTimeout) {
                clearTimeout(this.toastTimeout);
                this.toastTimeout = null;
            }
        } catch (error) {
            console.error('Toast hide error:', error);
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.fitTrackerApp = new FitTrackerApp();
        
        // Handle page visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && window.fitTrackerApp) {
                window.fitTrackerApp.userData.save();
            }
        });
        
        // Handle before unload
        window.addEventListener('beforeunload', () => {
            if (window.fitTrackerApp) {
                window.fitTrackerApp.userData.save();
            }
        });
    } catch (error) {
        console.error('App initialization failed:', error);
        // Show fallback UI
        document.body.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; font-family: Arial, sans-serif;">
                <h1>FitTracker Pro</h1>
                <p>Loading failed. Please refresh the page.</p>
                <button onclick="location.reload()" style="padding: 12px 24px; background: #1FB8CD; color: white; border: none; border-radius: 8px; cursor: pointer;">Refresh</button>
            </div>
        `;
    }
});
