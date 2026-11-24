/**
 * ============================================================
 * CogniCare - translations.js
 * ------------------------------------------------------------
 * All text shown to the user, in Bahasa Malaysia (bm) and
 * English (en), plus small helper functions.
 *
 * HOW TO USE IN HTML (static text):
 *     <h1 data-i18n="welcome"></h1>
 *     <input data-i18n-placeholder="email">
 *     <button data-i18n="save" data-i18n-aria-label="save"></button>
 *   then call  applyTranslations();  once the page has loaded.
 *
 * HOW TO USE IN JAVASCRIPT (dynamic text):
 *     import { t } from "./translations.js";
 *     statusEl.textContent = t("voiceStreak", { days: 5 });
 *
 * RULE: every key must exist in BOTH bm and en. If you add a key
 * to one, add it to the other too.
 *
 * FR008 (language preference) and FR013 (instructions in the
 * selected language) are handled by this file.
 * ============================================================
 */

// ------------------------------------------------------------
// 1. TRANSLATION TABLE
// ------------------------------------------------------------
export const translations = {
  // ==========================================================
  // BAHASA MALAYSIA
  // ==========================================================
  bm: {
    // ---- App ----
    appName: "CogniCare",
    tagline: "Latihan otak untuk hati yang ceria",

    // ---- Navigation ----
    home: "Utama",
    practice: "Latihan",
    progress: "Kemajuan",
    mainMenu: "Menu utama",
    games: "Permainan",
    dashboard: "Papan Pemuka",
    settings: "Tetapan",
    login: "Log Masuk",
    register: "Daftar",
    logout: "Log Keluar",
    admin: "Pentadbir",
    skipToContent: "Terus ke kandungan utama",

    // ---- Messages ----
    welcome: "Selamat datang",
    welcomeUser: "Selamat datang, {name}!",
    welcomeText: "Jom latih otak anda dengan permainan yang mudah dan menyeronokkan.",
    welcomeHeadline: "Latih minda anda, sedikit setiap hari.",
    welcomeSub: "Permainan ringkas untuk Perhatian, Kelajuan Otak dan Ingatan.",
    noTimeLimit: "Tiada had masa. Anda boleh berhenti bila-bila masa.",
    goodJob: "Bagus!",
    tryAgain: "Cuba lagi",
    noScoresYet: "Belum ada markah. Mainkan permainan untuk bermula!",
    loading: "Sila tunggu...",
    saved: "Berjaya disimpan.",
    pleaseLoginFirst: "Sila log masuk dahulu.",
    accessDenied: "Anda tidak dibenarkan melihat halaman ini.",

    // ---- Buttons ----
    yes: "YA",
    no: "TIDAK",
    playAgain: "Main Lagi",
    save: "Simpan",
    cancel: "Batal",
    back: "Kembali",
    confirm: "Sahkan",
    delete: "Padam",
    close: "Tutup",
    search: "Cari",
    continue: "Teruskan",

    // ---- Login / Register ----
    loginTitle: "Log Masuk ke Akaun Anda",
    registerTitle: "Cipta Akaun Baharu",
    email: "E-mel",
    password: "Kata laluan",
    confirmPassword: "Sahkan kata laluan",
    fullName: "Nama penuh",
    age: "Umur",
    role: "Peranan",
    roleElderly: "Warga Emas",
    roleCaregiver: "Penjaga",
    roleAdmin: "Pentadbir",
    forgotPassword: "Terlupa kata laluan?",
    resetPasswordTitle: "Tetapkan Semula Kata Laluan",
    resetPasswordText: "Masukkan e-mel anda. Kami akan hantar pautan untuk menetapkan kata laluan baharu.",
    sendResetLink: "Hantar Pautan",
    resetLinkSent: "Pautan telah dihantar ke e-mel anda. Sila semak peti masuk.",
    noAccountYet: "Belum ada akaun?",
    haveAccount: "Sudah ada akaun?",
    showPassword: "Tunjukkan kata laluan",
    registerSuccess: "Akaun berjaya dicipta!",
    passwordsNotMatch: "Kata laluan tidak sama.",
    ageRange: "Sila masukkan umur yang betul.",
    fieldRequired: "Ruangan ini wajib diisi.",

    // ---- Errors ----
    errInvalidEmail: "Alamat e-mel tidak betul.",
    errWrongLogin: "E-mel atau kata laluan salah.",
    errEmailUsed: "E-mel ini sudah didaftarkan.",
    passwordHint: "Sekurang-kurangnya 6 aksara.",
    errWeakPassword: "Kata laluan mestilah sekurang-kurangnya 6 aksara.",
    errTooMany: "Terlalu banyak percubaan. Sila tunggu sebentar.",
    errNetwork: "Tiada sambungan internet.",
    errGeneric: "Maaf, ada masalah. Sila cuba lagi.",

    // ---- Disclaimer (mandatory for new users) ----
    disclaimerBadge: "Langkah wajib untuk pengguna baharu",
    disclaimerTitle: "Sebelum anda bermula",
    disclaimerIntro: "Sila baca perkara penting ini.",
    disclaimer1: "Cadangan dalam CogniCare hanyalah cadangan, bukan nasihat perubatan.",
    disclaimer2: "Ia bukan diagnosis dan tidak menggantikan doktor.",
    disclaimer3: "Aktiviti ini membantu mengaktifkan minda warga emas.",
    disclaimer4: "Cadangan mungkin tidak sama dengan pendapat pakar.",
    disclaimerAgree: "Saya faham dan setuju",
    disclaimerContinue: "Teruskan",
    disclaimerHelp: "Butang aktif selepas anda menanda kotak di atas.",
    disclaimerShort: "Cadangan sahaja. Bukan nasihat perubatan dan bukan diagnosis.",
    readDisclaimerAgain: "Baca penafian semula",

    // ---- Categories and the three games ----
    catMemory: "Ingatan",
    catAttention: "Perhatian",
    catSpeed: "Kelajuan Otak",
    catMemoryDesc: "Mengingat dan mencari pasangan",
    catAttentionDesc: "Memberi tumpuan dan mencari sasaran",
    catSpeedDesc: "Bertindak balas dengan cepat",
    gameCardPairs: "Padankan Kad",
    gameFindTarget: "Cari Sasaran",
    gameQuickTap: "Tekan Pantas",

    // ---- Where should we start? ----
    focusTitle: "Di mana kita mula?",
    focusSub: "Pilih satu. Anda boleh tukar bila-bila masa.",
    focusNotSure: "Tidak pasti? Cadangkan untuk saya",

    // ---- Card Pairs game ----
    pairsHow: "Mula-mula semua kad ditunjukkan. Ingat kedudukannya, kemudian kad ditutup. Ketik dua kad untuk mencari pasangan. Tiada had masa.",
    pairsStudy: "Lihat dan ingat kad-kad ini. Tekan butang apabila anda sudah bersedia.",
    pairsReady: "Saya sudah ingat, tutup kad",
    pairsNowFind: "Sekarang cari pasangan.",
    pairsLevel: "Tahap {n}: {cards} kad",
    pairsTries: "Cubaan: {n}",
    pairsFound: "Pasangan: {found} daripada {total}",
    pairsBoard: "Papan kad",
    pairsCardHidden: "Kad {n}, tertutup",
    pairsCardShown: "Kad {n}: {name}",
    pairsMatch: "Padan!",
    pairsNoMatch: "Tidak sama. Cuba lagi.",
    pairsDoneTitle: "Hebat! Semua pasangan ditemui.",
    pairsResultTries: "Cubaan: {n}",
    pairsResultAccuracy: "Ketepatan: {n}%",
    pairsResultTime: "Masa: {n} saat",
    pairsNextLevel: "Kali seterusnya kita cuba {cards} kad.",
    pairsSameLevel: "Kita kekalkan {cards} kad dahulu.",
    pairsEasier: "Tidak mengapa. Kita cuba {cards} kad.",
    symCircle: "bulatan",
    symSquare: "segi empat",
    symTriangle: "segi tiga",
    symStar: "bintang",
    symHeart: "hati",
    symMoon: "bulan",
    symSun: "matahari",
    symLeaf: "daun",

        // ---- Find the Target game (Stroop style) ----
    colRed: "MERAH",
    colBlue: "BIRU",
    colGreen: "HIJAU",
    colOrange: "OREN",
    colPurple: "UNGU",
    findHowWord: "Satu perkataan warna akan dipaparkan. Tekan butang yang sama dengan WARNA TULISAN, bukan maksud perkataan itu. Ada 12 pusingan. Tiada had masa.",
    findHowShape: "Satu bentuk akan dipaparkan dengan perkataan di dalamnya. Tekan butang yang sama dengan WARNA SEMPADAN bentuk, abaikan perkataan di dalamnya. Ada 12 pusingan. Tiada had masa.",
    findPromptWord: "Tekan warna TULISAN",
    findPromptShape: "Tekan warna SEMPADAN",
    findExampleWord: "Contoh: perkataan MERAH ditulis dengan warna biru. Tekan BIRU.",
    findExampleShape: "Contoh: bentuk bersempadan biru dengan perkataan MERAH di dalam. Tekan BIRU.",
    findAnswers: "Butang warna",
    findLevel: "Tahap {n} daripada {total}",
    findRound: "Pusingan {n} daripada {total}",
    findCorrect: "Betul! Bagus.",
    findWrong: "Bukan yang itu. Kita teruskan.",
    findDoneTitle: "Hebat! Semua pusingan selesai.",
    findResultRounds: "Betul: {right} daripada {total}",
    findResultAccuracy: "Ketepatan: {n}%",
    findResultTime: "Purata masa menjawab: {n} saat",
    findNextLevel: "Kali seterusnya kita cuba tahap {n}.",
    findSameLevel: "Kita kekalkan tahap {n} dahulu.",
    findEasier: "Tidak mengapa. Kita cuba tahap {n}.",


    // ---- Home ----
    greetingMorning: "Selamat pagi, {name}",
    greetingAfternoon: "Selamat tengah hari, {name}",
    greetingEvening: "Selamat petang, {name}",
    homeToday: "Latihan hari ini: 5 minit sahaja.",
    suggestionTitle: "Cadangan untuk anda",
    suggestionTry: "Cuba {category} hari ini. Ia sekadar cadangan.",

    // ---- Progress and AI suggestions ----
    progressTitle: "Kemajuan anda",
    statusImproving: "Semakin baik",
    statusSteady: "Stabil",
    statusStarting: "Baru bermula",
    byCategory: "Mengikut kategori",
    levelOf: "Tahap {n} daripada {total}",
    accuracyPct: "Ketepatan {n}%",
    why: "Kenapa",
    streakDays: "Anda bermain {days} hari berturut-turut.",
    howLevelsChange: "Bagaimana tahap berubah",
    levelRule: "Naik satu tahap apabila ketepatan 80% atau lebih dalam 3 sesi. Turun satu tahap apabila di bawah 50%.",
    howAiWorks: "Bagaimana AI berfungsi",

    // ---- Settings / Profile ----
    settingsTitle: "Tetapan Anda",
    profile: "Profil",
    profileUpdated: "Profil berjaya dikemas kini.",
    language: "Bahasa",
    languageBM: "Bahasa Malaysia",
    languageEN: "English",
    fontSize: "Saiz Tulisan",
    fontSmall: "Kecil",
    fontMedium: "Sederhana",
    fontLarge: "Besar",
    fontExtraLarge: "Sangat Besar",
    highContrastMode: "Mod Kontras Tinggi",
    on: "Hidup",
    off: "Mati",
    preview: "Contoh tulisan: Ini ialah saiz tulisan anda.",
    memberSince: "Ahli sejak",
    voiceAssistant: "Pembantu suara",
    account: "Akaun",

    // ---- Caregiver ----
    linkElderly: "Pautkan Warga Emas",
    linkElderlyText: "Masukkan e-mel warga emas yang ingin anda pantau.",
    elderlyEmail: "E-mel warga emas",
    linkButton: "Pautkan",
    linkSuccess: "Berjaya dipautkan dengan {name}.",
    linkNotFound: "Tiada warga emas dengan e-mel ini.",
    linkedUsers: "Warga Emas yang Dipautkan",
    noLinkedUsers: "Belum ada warga emas dipautkan.",
    unlink: "Buang Pautan",
    selectElderly: "Pilih warga emas",
    linkCaregiver: "Pautkan penjaga",
    linkCaregiverText: "Kongsi kemajuan anda dengan ahli keluarga. Anda boleh putuskan pautan bila-bila masa.",
    caregiverEmail: "E-mel penjaga",
    caregiverEmailHint: "Penjaga mesti sudah mendaftar.",
    sendLink: "Hantar pautan",
    yourCaregivers: "Penjaga anda",

    // ---- Games (general) ----
    gamesTitle: "Pilih Permainan",
    startGame: "Mula Permainan",
    endGame: "Tamat Permainan",
    score: "Markah",
    level: "Tahap",
    correct: "Betul",
    wrong: "Salah",
    round: "Pusingan",
    roundsOf: "Pusingan {current} daripada {total}",
    gameOver: "Permainan Tamat",
    finalScore: "Markah akhir anda: {score}",
    howToPlay: "Cara Bermain",
    instructions: "Arahan",
    hint: "Petunjuk",
    time: "Masa",
    seconds: "saat",
    gameSaved: "Markah anda telah disimpan.",
    gameSaveFailed: "Markah tidak dapat disimpan. Sila semak sambungan internet.",
    voiceOn: "Suara Hidup",
    voiceOff: "Suara Mati",
    readAloud: "Baca dengan Kuat",
    listening: "Sedang mendengar...",
    sayStart: "Sebut \"Mula\" untuk bermula.",

    // ---- LEGACY: N-Back (hidden from the new app, kept for old pages) ----
    nback: "N-Back",
    nbackDesc: "Latih ingatan kerja anda",
    nbackLevel: "Tahap: {n}-back",
    nback1: "1-back: Tekan YA jika nombor ini sama dengan nombor SEBELUM ini. Jika tidak, tekan TIDAK.",
    nback2: "2-back: Tekan YA jika nombor ini sama dengan nombor DUA langkah sebelum ini. Jika tidak, tekan TIDAK.",
    nback3: "3-back: Tekan YA jika nombor ini sama dengan nombor TIGA langkah sebelum ini. Jika tidak, tekan TIDAK.",
    nbackGeneral: "Satu nombor akan muncul selama 2 saat. Ingat nombor-nombor tersebut dan jawab YA atau TIDAK.",
    nbackLevelUp: "Hebat! Tahap naik kepada {n}-back.",
    nbackLevelDown: "Tidak mengapa. Kita cuba tahap {n}-back.",
    nbackRemember: "Ingat nombor ini.",
    nbackQuestion: "Adakah nombor ini sama dengan nombor {n} langkah yang lalu?",
    nbackQuestion1: "Sama dengan nombor tadi?",
    pauseGame: "Jeda",
    resumeGame: "Sambung",
    paused: "Permainan dijeda",
    pausedText: "Ambil masa anda. Tekan Sambung apabila sudah bersedia. Pusingan ini akan bermula semula dengan nombor baharu.",
    next: "Seterusnya",
    finish: "Selesai",
    practiceTitle: "Pusingan Latihan",
    practiceNote: "Latihan ini tidak dikira dalam markah anda dan tiada tekanan masa.",
    practiceTip: "Kali pertama? Cuba latihan ringkas dahulu supaya lebih mudah faham.",
    practiceRemember: "Lihat nombor ini dan ingat. Kemudian tekan Seterusnya.",
    practiceSame: "Betul! {a} sama dengan nombor tadi ({b}). Jawapan: YA.",
    practiceDiff: "{a} tidak sama dengan nombor tadi ({b}). Jawapan: TIDAK.",
    practiceDone: "Bagus! Anda sudah faham cara bermain. Tekan Mula Permainan bila bersedia.",
    practiceSkip: "Langkau",
    accuracy: "Ketepatan",
    peakLevel: "Tahap tertinggi",
    avgAnswerTime: "Purata masa menjawab",
    confirmEndGame: "Tamatkan permainan sekarang? Markah anda setakat ini akan disimpan.",

    // ---- LEGACY: Match-3 ----
    match3: "Padan-3",
    match3Desc: "Latih perhatian dan pengecaman corak",
    match3Level: "Grid: {size}",
    match3General: "Tukar dua jubin yang bersebelahan untuk membuat satu baris tiga jubin yang sama warna atau bentuk.",
    match3Grid3: "Grid 3x3: Ketik satu jubin, kemudian ketik jubin di sebelahnya untuk menukar tempat.",
    match3Grid4: "Grid 4x4: Cari tiga jubin yang sama dalam satu baris atau satu lajur.",
    match3Grid5: "Grid 5x5: Cuba buat gabungan berturut-turut untuk mendapat markah bonus.",
    match3Target: "Sasaran: {n} padanan",
    match3Combo: "Gabungan x{n}!",
    match3Stuck: "Perlukan bantuan? Tekan butang Petunjuk.",
    match3Selected: "Jubin dipilih",
    match3GridUp: "Hebat! Grid menjadi {size}.",
    match3GridDown: "Kita cuba grid yang lebih kecil: {size}.",

    // ---- Dashboard ----
    dashboardTitle: "Kemajuan Anda",
    totalGames: "Jumlah Permainan",
    averageScore: "Purata Markah",
    bestScore: "Markah Terbaik",
    filterByGameType: "Tapis mengikut jenis permainan",
    allGames: "Semua Permainan",
    scoreHistory: "Sejarah Markah",
    scoreOverTime: "Markah dari Semasa ke Semasa",
    date: "Tarikh",
    gameType: "Jenis Permainan",
    difficulty: "Kesukaran",
    duration: "Tempoh",
    viewingProgressOf: "Melihat kemajuan: {name}",
    allUsersProgress: "Kemajuan Semua Pengguna",
    user: "Pengguna",
    noData: "Tiada data untuk dipaparkan.",

    // ---- Admin ----
    adminPanel: "Panel Pentadbir",
    allUsers: "Semua Pengguna",
    deleteUser: "Padam Pengguna",
    confirmDeleteUser: "Adakah anda pasti mahu memadam {name}? Tindakan ini tidak boleh dibatalkan.",
    userDeleted: "Pengguna telah dipadam.",
    systemLogs: "Log Sistem",
    systemPerformance: "Prestasi Sistem",
    systemConfig: "Konfigurasi Sistem",
    action: "Tindakan",
    details: "Butiran",
    totalUsers: "Jumlah Pengguna",
    totalSessions: "Jumlah Sesi Permainan",
    activePlayers: "Pemain Aktif (7 hari)",
    responseTime: "Masa Respons Pangkalan Data",
    status: "Status",
    name: "Nama",

    // ---- Voice assistant phrases (spoken aloud) ----
    voiceWelcome: "Selamat datang ke CogniCare. Mari kita mulakan latihan otak.",
    voiceCorrect: "Bagus! Teruskan!",
    voiceWrong: "Tidak mengapa. Mari cuba lagi.",
    voiceHintNback: "Ingat nombor sebelum ini.",
    voiceHintMatch3: "Cuba tukar jubin yang bersebelahan.",
    voiceStreak: "Anda telah bermain {days} hari berturut-turut! Syabas!",
    voiceGameOver: "Permainan tamat. Markah anda ialah {score}. Syabas!",
    voiceNotSupported: "Pelayar anda tidak menyokong suara.",
  },

  // ==========================================================
  // ENGLISH
  // ==========================================================
  en: {
    // ---- App ----
    appName: "CogniCare",
    tagline: "Brain training for a happy heart",

    // ---- Navigation ----
    home: "Home",
    practice: "Practice",
    progress: "Progress",
    mainMenu: "Main menu",
    games: "Games",
    dashboard: "Dashboard",
    settings: "Settings",
    login: "Login",
    register: "Register",
    logout: "Logout",
    admin: "Admin",
    skipToContent: "Skip to main content",

    // ---- Messages ----
    welcome: "Welcome",
    welcomeUser: "Welcome, {name}!",
    welcomeText: "Let's train your brain with simple and enjoyable games.",
    welcomeHeadline: "Train your mind, a little every day.",
    welcomeSub: "Simple games for Attention, Brain Speed and Memory.",
    noTimeLimit: "No time limits. You can stop at any time.",
    goodJob: "Good Job!",
    tryAgain: "Try Again",
    noScoresYet: "No scores yet. Play a game to get started!",
    loading: "Please wait...",
    saved: "Saved successfully.",
    pleaseLoginFirst: "Please log in first.",
    accessDenied: "You are not allowed to view this page.",

    // ---- Buttons ----
    yes: "YES",
    no: "NO",
    playAgain: "Play Again",
    save: "Save",
    cancel: "Cancel",
    back: "Back",
    confirm: "Confirm",
    delete: "Delete",
    close: "Close",
    search: "Search",
    continue: "Continue",

    // ---- Login / Register ----
    loginTitle: "Log In to Your Account",
    registerTitle: "Create a New Account",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm password",
    fullName: "Full name",
    age: "Age",
    role: "Role",
    roleElderly: "Elderly User",
    roleCaregiver: "Caregiver",
    roleAdmin: "Administrator",
    forgotPassword: "Forgot password?",
    resetPasswordTitle: "Reset Your Password",
    resetPasswordText: "Enter your email. We will send you a link to set a new password.",
    sendResetLink: "Send Link",
    resetLinkSent: "A link has been sent to your email. Please check your inbox.",
    noAccountYet: "Don't have an account?",
    haveAccount: "Already have an account?",
    showPassword: "Show password",
    registerSuccess: "Account created successfully!",
    passwordsNotMatch: "Passwords do not match.",
    ageRange: "Please enter a valid age.",
    fieldRequired: "This field is required.",

    // ---- Errors ----
    errInvalidEmail: "That email address does not look right.",
    errWrongLogin: "Email or password is incorrect.",
    errEmailUsed: "This email is already registered.",
    passwordHint: "At least 6 characters.",
    errWeakPassword: "Password must be at least 6 characters.",
    errTooMany: "Too many tries. Please wait and try again.",
    errNetwork: "No internet connection.",
    errGeneric: "Sorry, something went wrong. Please try again.",

    // ---- Disclaimer (mandatory for new users) ----
    disclaimerBadge: "Required step for new users",
    disclaimerTitle: "Before you start",
    disclaimerIntro: "Please read these important points.",
    disclaimer1: "Suggestions in CogniCare are suggestions only, not medical advice.",
    disclaimer2: "It is not a diagnosis and does not replace a doctor.",
    disclaimer3: "These activities help keep the minds of older adults active.",
    disclaimer4: "Suggestions may differ from the opinion of an expert.",
    disclaimerAgree: "I understand and agree",
    disclaimerContinue: "Continue",
    disclaimerHelp: "The button works after you tick the box above.",
    disclaimerShort: "Suggestions only. Not medical advice and not a diagnosis.",
    readDisclaimerAgain: "Read the disclaimer again",

    // ---- Categories and the three games ----
    catMemory: "Memory",
    catAttention: "Attention",
    catSpeed: "Brain Speed",
    catMemoryDesc: "Remember and find pairs",
    catAttentionDesc: "Focus and find the target",
    catSpeedDesc: "React quickly",
    gameCardPairs: "Card Pairs",
    gameFindTarget: "Find the Target",
    gameQuickTap: "Quick Tap",

    // ---- Where should we start? ----
    focusTitle: "Where should we start?",
    focusSub: "Pick one. You can change it at any time.",
    focusNotSure: "Not sure? Suggest one for me",

    // ---- Card Pairs game ----
    pairsHow: "First, all the cards are shown. Remember where they are, then the cards turn over. Tap two cards to find the pairs. There is no time limit.",
    pairsStudy: "Look at these cards and remember them. Press the button when you are ready.",
    pairsReady: "I remember them, turn the cards over",
    pairsNowFind: "Now find the pairs.",
    pairsLevel: "Level {n}: {cards} cards",
    pairsTries: "Tries: {n}",
    pairsFound: "Pairs: {found} of {total}",
    pairsBoard: "Card board",
    pairsCardHidden: "Card {n}, face down",
    pairsCardShown: "Card {n}: {name}",
    pairsMatch: "A match!",
    pairsNoMatch: "Not a match. Try again.",
    pairsDoneTitle: "Well done! You found every pair.",
    pairsResultTries: "Tries: {n}",
    pairsResultAccuracy: "Accuracy: {n}%",
    pairsResultTime: "Time: {n} seconds",
    pairsNextLevel: "Next time we will try {cards} cards.",
    pairsSameLevel: "We will stay with {cards} cards for now.",
    pairsEasier: "That's okay. We will try {cards} cards.",
    symCircle: "circle",
    symSquare: "square",
    symTriangle: "triangle",
    symStar: "star",
    symHeart: "heart",
    symMoon: "moon",
    symSun: "sun",
    symLeaf: "leaf",

        // ---- Find the Target game (Stroop style) ----
    colRed: "RED",
    colBlue: "BLUE",
    colGreen: "GREEN",
    colOrange: "ORANGE",
    colPurple: "PURPLE",
    findHowWord: "A colour word will be shown. Press the button that matches the COLOUR OF THE TEXT, not what the word says. There are 12 rounds. There is no time limit.",
    findHowShape: "A shape will be shown with a word inside it. Press the button that matches the BORDER COLOUR of the shape, and ignore the word inside. There are 12 rounds. There is no time limit.",
    findPromptWord: "Press the colour of the TEXT",
    findPromptShape: "Press the colour of the BORDER",
    findExampleWord: "Example: the word RED written in blue. Press BLUE.",
    findExampleShape: "Example: a shape with a blue border and the word RED inside. Press BLUE.",
    findAnswers: "Colour buttons",
    findLevel: "Level {n} of {total}",
    findRound: "Round {n} of {total}",
    findCorrect: "Correct! Well done.",
    findWrong: "Not that one. Let's keep going.",
    findDoneTitle: "Well done! All rounds finished.",
    findResultRounds: "Correct: {right} of {total}",
    findResultAccuracy: "Accuracy: {n}%",
    findResultTime: "Average answer time: {n} seconds",
    findNextLevel: "Next time we will try level {n}.",
    findSameLevel: "We will stay at level {n} for now.",
    findEasier: "That's okay. We will try level {n}.",
    
    // ---- Home ----
    greetingMorning: "Good morning, {name}",
    greetingAfternoon: "Good afternoon, {name}",
    greetingEvening: "Good evening, {name}",
    homeToday: "Today's practice: just 5 minutes.",
    suggestionTitle: "Suggestion for you",
    suggestionTry: "Try {category} today. It is only a suggestion.",

    // ---- Progress and AI suggestions ----
    progressTitle: "Your progress",
    statusImproving: "Getting better",
    statusSteady: "Steady",
    statusStarting: "Just starting",
    byCategory: "By category",
    levelOf: "Level {n} of {total}",
    accuracyPct: "Accuracy {n}%",
    why: "Why",
    streakDays: "You played {days} days in a row.",
    howLevelsChange: "How levels change",
    levelRule: "Go up one level when accuracy is 80% or more in 3 sessions. Go down one level when it is below 50%.",
    howAiWorks: "How the AI works",

    // ---- Settings / Profile ----
    settingsTitle: "Your Settings",
    profile: "Profile",
    profileUpdated: "Profile updated successfully.",
    language: "Language",
    languageBM: "Bahasa Malaysia",
    languageEN: "English",
    fontSize: "Font Size",
    fontSmall: "Small",
    fontMedium: "Medium",
    fontLarge: "Large",
    fontExtraLarge: "Extra Large",
    highContrastMode: "High Contrast Mode",
    on: "On",
    off: "Off",
    preview: "Sample text: This is your font size.",
    memberSince: "Member since",
    voiceAssistant: "Voice assistant",
    account: "Account",

    // ---- Caregiver ----
    linkElderly: "Link Elderly User",
    linkElderlyText: "Enter the email of the elderly user you want to follow.",
    elderlyEmail: "Elderly user's email",
    linkButton: "Link",
    linkSuccess: "Successfully linked with {name}.",
    linkNotFound: "No elderly user found with this email.",
    linkedUsers: "Linked Elderly Users",
    noLinkedUsers: "No elderly users linked yet.",
    unlink: "Remove Link",
    selectElderly: "Select elderly user",
    linkCaregiver: "Link a caregiver",
    linkCaregiverText: "Share your progress with a family member. You can remove the link at any time.",
    caregiverEmail: "Caregiver's email",
    caregiverEmailHint: "The caregiver must already be registered.",
    sendLink: "Send link",
    yourCaregivers: "Your caregivers",

    // ---- Games (general) ----
    gamesTitle: "Choose a Game",
    startGame: "Start Game",
    endGame: "End Game",
    score: "Score",
    level: "Level",
    correct: "Correct",
    wrong: "Wrong",
    round: "Round",
    roundsOf: "Round {current} of {total}",
    gameOver: "Game Over",
    finalScore: "Your final score: {score}",
    howToPlay: "How to Play",
    instructions: "Instructions",
    hint: "Hint",
    time: "Time",
    seconds: "seconds",
    gameSaved: "Your score has been saved.",
    gameSaveFailed: "Score could not be saved. Please check your internet connection.",
    voiceOn: "Voice On",
    voiceOff: "Voice Off",
    readAloud: "Read Aloud",
    listening: "Listening...",
    sayStart: "Say \"Start\" to begin.",

    // ---- LEGACY: N-Back (hidden from the new app, kept for old pages) ----
    nback: "N-Back",
    nbackDesc: "Train your working memory",
    nbackLevel: "Level: {n}-back",
    nback1: "1-back: Press YES if this number is the same as the number BEFORE it. If not, press NO.",
    nback2: "2-back: Press YES if this number is the same as the number TWO steps before. If not, press NO.",
    nback3: "3-back: Press YES if this number is the same as the number THREE steps before. If not, press NO.",
    nbackGeneral: "A number will appear for 2 seconds. Remember the numbers and answer YES or NO.",
    nbackLevelUp: "Great! Level up to {n}-back.",
    nbackLevelDown: "That's okay. Let's try {n}-back.",
    nbackRemember: "Remember this number.",
    nbackQuestion: "Is this number the same as the number {n} steps ago?",
    nbackQuestion1: "Same as the last number?",
    pauseGame: "Pause",
    resumeGame: "Resume",
    paused: "Game paused",
    pausedText: "Take your time. Press Resume when you are ready. This round will restart with a new number.",
    next: "Next",
    finish: "Finish",
    practiceTitle: "Practice Round",
    practiceNote: "This practice does not count towards your score and has no time pressure.",
    practiceTip: "First time? Try a short practice first so it is easier to understand.",
    practiceRemember: "Look at this number and remember it. Then press Next.",
    practiceSame: "Correct! {a} is the same as the last number ({b}). Answer: YES.",
    practiceDiff: "{a} is not the same as the last number ({b}). Answer: NO.",
    practiceDone: "Well done! You know how to play now. Press Start Game when you are ready.",
    practiceSkip: "Skip",
    accuracy: "Accuracy",
    peakLevel: "Highest level",
    avgAnswerTime: "Average answer time",
    confirmEndGame: "End the game now? Your score so far will be saved.",

    // ---- LEGACY: Match-3 ----
    match3: "Match-3",
    match3Desc: "Train your attention and pattern recognition",
    match3Level: "Grid: {size}",
    match3General: "Swap two neighbouring tiles to make a line of three tiles with the same colour and shape.",
    match3Grid3: "3x3 grid: Tap one tile, then tap the tile next to it to swap them.",
    match3Grid4: "4x4 grid: Look for three matching tiles in a row or a column.",
    match3Grid5: "5x5 grid: Try to make matches one after another for bonus points.",
    match3Target: "Target: {n} matches",
    match3Combo: "Combo x{n}!",
    match3Stuck: "Need help? Press the Hint button.",
    match3Selected: "Tile selected",
    match3GridUp: "Great! The grid is now {size}.",
    match3GridDown: "Let's try a smaller grid: {size}.",

    // ---- Dashboard ----
    dashboardTitle: "Your Progress",
    totalGames: "Total Games",
    averageScore: "Average Score",
    bestScore: "Best Score",
    filterByGameType: "Filter by Game Type",
    allGames: "All Games",
    scoreHistory: "Score History",
    scoreOverTime: "Scores Over Time",
    date: "Date",
    gameType: "Game Type",
    difficulty: "Difficulty",
    duration: "Duration",
    viewingProgressOf: "Viewing progress of: {name}",
    allUsersProgress: "All Users' Progress",
    user: "User",
    noData: "No data to show.",

    // ---- Admin ----
    adminPanel: "Admin Panel",
    allUsers: "All Users",
    deleteUser: "Delete User",
    confirmDeleteUser: "Are you sure you want to delete {name}? This cannot be undone.",
    userDeleted: "User has been deleted.",
    systemLogs: "System Logs",
    systemPerformance: "System Performance",
    systemConfig: "System Configuration",
    action: "Action",
    details: "Details",
    totalUsers: "Total Users",
    totalSessions: "Total Game Sessions",
    activePlayers: "Active Players (7 days)",
    responseTime: "Database Response Time",
    status: "Status",
    name: "Name",

    // ---- Voice assistant phrases (spoken aloud) ----
    voiceWelcome: "Welcome to CogniCare. Let's start training your brain.",
    voiceCorrect: "Great job! Keep going!",
    voiceWrong: "That's okay. Let's try again.",
    voiceHintNback: "Remember the previous number.",
    voiceHintMatch3: "Try swapping two neighbouring tiles.",
    voiceStreak: "You've played {days} days in a row! Well done!",
    voiceGameOver: "Game over. Your score is {score}. Well done!",
    voiceNotSupported: "Your browser does not support voice.",
  },
};

// ------------------------------------------------------------
// 2. LANGUAGE STATE
// ------------------------------------------------------------
const STORAGE_KEY = "cognicare_lang";
const DEFAULT_LANG = "bm";

/**
 * Current language ("bm" or "en").
 * Saved in localStorage so the login/register pages (before the
 * user's profile is loaded from the API) remember the last choice.
 */
export function getLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && translations[saved] ? saved : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG; // storage blocked (private mode) -> use default
  }
}

/** Change language, remember it, and re-translate the page. */
export function setLanguage(lang) {
  if (!translations[lang]) return;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore - language just will not persist */
  }
  applyTranslations();
  // Let other scripts (games, dashboard, voice) know the language changed
  window.dispatchEvent(new CustomEvent("languagechange", { detail: { lang } }));
}

// ------------------------------------------------------------
// 3. TRANSLATE FUNCTION
// ------------------------------------------------------------

/**
 * Get text for a key in the current language.
 * Placeholders like {name} are replaced from `params`.
 * Falls back to English, then to the key itself, so a missing
 * translation never shows a blank screen.
 *
 * @param {string} key
 * @param {Object} [params]   e.g. { name: "Ahmad", n: 2 }
 * @param {string} [lang]     override the current language
 */
export function t(key, params = {}, lang = getLanguage()) {
  let text = translations[lang]?.[key] ?? translations.en[key] ?? key;
  for (const [name, value] of Object.entries(params)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

// ------------------------------------------------------------
// 4. APPLY TO THE PAGE
// ------------------------------------------------------------

/**
 * Translate every element that has a data-i18n* attribute.
 *   data-i18n="key"              -> sets the text
 *   data-i18n-placeholder="key"  -> sets the placeholder
 *   data-i18n-title="key"        -> sets the title tooltip
 *   data-i18n-aria-label="key"   -> sets aria-label (screen readers)
 */
export function applyTranslations(root = document) {
  document.documentElement.lang = getLanguage() === "bm" ? "ms" : "en";

  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  root.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel));
  });
}

// ------------------------------------------------------------
// 5. HELPERS FOR OTHER FILES
// ------------------------------------------------------------

/**
 * Speech locale for the Web Speech API (SpeechSynthesis and
 * SpeechRecognition). Bahasa Malaysia = "ms-MY".
 */
export function getSpeechLocale(lang = getLanguage()) {
  return lang === "bm" ? "ms-MY" : "en-US";
}

/** Words the voice recogniser should treat as YES / NO / HINT / START. */
export const voiceCommands = {
  bm: {
    yes: ["ya", "betul", "yes"],
    no: ["tidak", "tak", "salah", "no"],
    hint: ["petunjuk", "bantuan", "hint"],
    start: ["mula", "start"],
  },
  en: {
    yes: ["yes", "yeah", "yep", "correct"],
    no: ["no", "nope", "wrong"],
    hint: ["hint", "help"],
    start: ["start", "begin"],
  },
};

/** Get the N-Back instruction text for a level (1, 2 or 3). */
export function nbackInstruction(level) {
  return t(`nback${level}`);
}

/** Get the Match-3 instruction text for a grid size (3, 4 or 5). */
export function match3Instruction(gridSize) {
  return t(`match3Grid${gridSize}`);
}

/** Translate a stored font-size value ("extra-large") to a label. */
export function fontSizeLabel(value) {
  const map = {
    small: "fontSmall",
    medium: "fontMedium",
    large: "fontLarge",
    "extra-large": "fontExtraLarge",
  };
  return t(map[value] || "fontMedium");
}

/** Translate a stored role value ("elderly") to a label. */
export function roleLabel(value) {
  const map = { elderly: "roleElderly", caregiver: "roleCaregiver", admin: "roleAdmin" };
  return t(map[value] || "roleElderly");
}