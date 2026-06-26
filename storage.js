const StorageManager = {
    KEYS: {
        USER_STATS: 'exam_user_stats',
        EXAM_HISTORY: 'exam_history',
        BOOKMARKS: 'exam_bookmarks'
    },

    // --- User Stats ---
    getUserStats() {
        const defaultStats = {
            xp: 0,
            level: 1,
            dailyStreak: 0,
            lastActiveDate: null,
            achievements: [],
            totalExamsTaken: 0,
            totalQuestionsAnswered: 0,
            totalCorrectAnswers: 0,
            totalTimeSpent: 0 // in seconds
        };
        const stats = localStorage.getItem(this.KEYS.USER_STATS);
        return stats ? JSON.parse(stats) : defaultStats;
    },

    saveUserStats(stats) {
        localStorage.setItem(this.KEYS.USER_STATS, JSON.stringify(stats));
    },

    updateStreak() {
        const stats = this.getUserStats();
        const today = new Date().toISOString().split('T')[0];
        
        if (stats.lastActiveDate !== today) {
            if (stats.lastActiveDate) {
                const lastDate = new Date(stats.lastActiveDate);
                const currentDate = new Date(today);
                const diffTime = Math.abs(currentDate - lastDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                
                if (diffDays === 1) {
                    stats.dailyStreak += 1;
                } else {
                    stats.dailyStreak = 1;
                }
            } else {
                stats.dailyStreak = 1;
            }
            stats.lastActiveDate = today;
            this.saveUserStats(stats);
        }
    },

    addXP(amount) {
        const stats = this.getUserStats();
        stats.xp += amount;
        // Simple level calculation: 100 XP per level
        const newLevel = Math.floor(stats.xp / 100) + 1;
        if (newLevel > stats.level) {
            // Level up!
            stats.level = newLevel;
            // You could trigger an event or notification here
        }
        this.saveUserStats(stats);
        return stats;
    },

    // --- Exam History ---
    getExamHistory() {
        const history = localStorage.getItem(this.KEYS.EXAM_HISTORY);
        return history ? JSON.parse(history) : [];
    },

    saveExamAttempt(attempt) {
        const history = this.getExamHistory();
        // Give attempt an ID if it doesn't have one
        if (!attempt.id) {
            attempt.id = 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        }
        history.push(attempt);
        localStorage.setItem(this.KEYS.EXAM_HISTORY, JSON.stringify(history));

        // Update overall stats
        const stats = this.getUserStats();
        stats.totalExamsTaken += 1;
        stats.totalQuestionsAnswered += attempt.totalQuestions;
        stats.totalCorrectAnswers += attempt.correctAnswers;
        stats.totalTimeSpent += attempt.durationSeconds;
        this.saveUserStats(stats);
        
        this.updateStreak();
        
        // Calculate XP based on score and time
        const xpEarned = Math.round(attempt.score) + (attempt.score === 100 ? 50 : 0);
        this.addXP(xpEarned);
        
        return attempt.id;
    },

    getAttemptById(id) {
        const history = this.getExamHistory();
        return history.find(att => att.id === id);
    },

    // --- Bookmarks ---
    getBookmarks() {
        const bms = localStorage.getItem(this.KEYS.BOOKMARKS);
        return bms ? JSON.parse(bms) : [];
    },

    addBookmark(testId, questionIndex, note = '') {
        const bms = this.getBookmarks();
        // Prevent duplicate bookmarking
        if (!bms.find(b => b.testId === testId && b.questionIndex === questionIndex)) {
            bms.push({ testId, questionIndex, note, dateAdded: new Date().toISOString() });
            localStorage.setItem(this.KEYS.BOOKMARKS, JSON.stringify(bms));
        }
    },

    removeBookmark(testId, questionIndex) {
        let bms = this.getBookmarks();
        bms = bms.filter(b => !(b.testId === testId && b.questionIndex === questionIndex));
        localStorage.setItem(this.KEYS.BOOKMARKS, JSON.stringify(bms));
    },

    isBookmarked(testId, questionIndex) {
        const bms = this.getBookmarks();
        return !!bms.find(b => b.testId === testId && b.questionIndex === questionIndex);
    }
};
