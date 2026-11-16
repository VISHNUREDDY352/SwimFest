/* ============================================================
   SwimFest icons  ·  core/icons.js
   Replaces the Font Awesome download (~100 KB CSS + font) with a
   small set of inline SVG line icons. Any <i class="fas fa-NAME">
   already in a page, or added later by a script, is swapped for the
   matching SVG. Icons are decorative (aria-hidden) unless the <i>
   carries an aria-label. Unknown names render nothing.
   Usage in new code:  SF.icon('search')  →  '<svg …>'
   ============================================================ */
(function () {
  'use strict';

  // 24×24 line icons (stroke = currentColor)
  const P = {
    swim:     '<path d="M2 18c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0"/><path d="M2 14c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0"/><circle cx="17" cy="6" r="2"/><path d="m6 12 5-5 3 2 3 3"/>',
    x:        '<path d="M18 6 6 18M6 6l12 12"/>',
    trophy:   '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    pin:      '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    check:    '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
    user:     '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users:    '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
    userPlus: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6"/>',
    shield:   '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    arrowLeft:  '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    arrowDown:  '<path d="M12 5v14M5 12l7 7 7-7"/>',
    arrowUp:  '<path d="M12 19V5M5 12l7-7 7 7"/>',
    sort:     '<path d="M8 9l4-4 4 4M8 15l4 4 4-4"/>',
    chevronDown:  '<path d="m6 9 6 6 6-6"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    chevronLeft:  '<path d="m15 6-6 6 6 6"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
    menu:     '<path d="M4 6h16M4 12h16M4 18h16"/>',
    logout:   '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    login:    '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
    flag:     '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
    send:     '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    medal:    '<circle cx="12" cy="15" r="6"/><path d="M8.5 10 6 2h4l2 5 2-5h4l-2.5 8"/>',
    lock:     '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    unlock:   '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.9-1"/>',
    plus:     '<path d="M12 5v14M5 12h14"/>',
    plusCircle: '<circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>',
    key:      '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m11 12 9-9M17 6l3 3"/>',
    info:     '<circle cx="12" cy="12" r="10"/><path d="M12 16v-5M12 8h.01"/>',
    spinner:  '<path d="M21 12a9 9 0 1 1-6.2-8.6"/>',
    search:   '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    pen:      '<path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
    list:     '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    listCheck: '<path d="m3 7 2 2 4-4M3 17l2 2 4-4M13 6h8M13 12h8M13 18h8"/>',
    clock:    '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    alert:    '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    alertCircle: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    broadcast: '<circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19.1 4.9a10 10 0 0 1 0 14.2M4.9 19.1a10 10 0 0 1 0-14.2"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    bolt:     '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    xCircle:  '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
    save:     '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    pool:     '<path d="M2 20c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0M2 16c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0"/><path d="M8 13V5a2 2 0 0 1 4 0M16 13V5a2 2 0 0 0-4 0M8 8h8"/>',
    stopwatch: '<circle cx="12" cy="14" r="8"/><path d="M12 10v4l2 2M10 2h4M12 2v4"/>',
    mail:     '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
    branch:   '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10M18 9a6 6 0 0 1-6 6H6"/>',
    clipboard: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 2h6v4H9zM9 13l2 2 4-4"/>',
    columns:  '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/>',
    fire:     '<path d="M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 3-5 6-5 8a7 7 0 0 0 7 7z"/>',
    hourglass: '<path d="M6 2h12M6 22h12M7 2v4a5 5 0 0 0 10 0V2M7 22v-4a5 5 0 0 1 10 0v4"/>',
    home:     '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    print:    '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    file:     '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    sheet:    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 12h8v6H8zM12 12v6M8 15h8"/>',
    eye:      '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff:   '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.9 9.9 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    upload:   '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    rupee:    '<path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a5 5 0 0 0 0-10"/>',
    refresh:  '<path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M3 21v-5h5"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>',
    bell:     '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    trash:    '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    square:   '<rect x="3" y="3" width="18" height="18" rx="2"/>',
    squareCheck: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m8 12 3 3 5-6"/>',
    chart:    '<path d="M3 3v18h18M8 17v-6M13 17V7M18 17v-3"/>',
    chat:     '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    ban:      '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    archive:  '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
    phone:    '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    globe:    '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/>',
    filter:   '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
    star:     '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    tag:      '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><path d="M7 7h.01"/>',
    image:    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
    gavel:    '<path d="m14 13-7.5 7.5a2.1 2.1 0 0 1-3-3L11 10M16 16l6-6M8 8l6-6M9 7l8 8M21 11l-8-8"/>',
    bot:      '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M12 8V4M8 4h8M9 14h.01M15 14h.01"/>',
    cake:     '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M4 16s1.5 1 4 1 4-2 4-2 1.5 2 4 2 4-1 4-1M2 21h20M7 8v3M12 8v3M17 8v3M7 4h.01M12 4h.01M17 4h.01"/>',
    gender:   '<circle cx="12" cy="9" r="6"/><path d="M12 15v7M9 19h6"/>',
    grip:     '<path d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01"/>',
    keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M7 15h10"/>',
    history:  '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2"/>',
    plug:     '<path d="M12 22v-5M9 8V2M15 8V2M18 8v4a6 6 0 0 1-12 0V8z"/>',
    card:     '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    dots:     '<path d="M5 12h.01M12 12h.01M19 12h.01"/>',
    signal:   '<path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16"/>',
    badge:    '<rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 17a4 4 0 0 1 8 0"/>',
    book:     '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    water:    '<path d="M12 2s7 7.5 7 13a7 7 0 0 1-14 0c0-5.5 7-13 7-13z"/>',
    caretDown: '<path d="m7 10 5 5 5-5z" fill="currentColor"/>',
    circle:   '<circle cx="12" cy="12" r="9"/>',
    teacher:  '<rect x="2" y="3" width="20" height="13" rx="1"/><path d="M8 21l4-5 4 5M12 3V1"/>',
  };

  // Font Awesome name → icon above
  const A = {
    swimmer: 'swim', 'person-swimming': 'swim', 'swimming-pool': 'pool', water: 'water',
    times: 'x', xmark: 'x', 'circle-xmark': 'xCircle', 'times-circle': 'xCircle', 'file-circle-xmark': 'xCircle',
    trophy: 'trophy', medal: 'medal', certificate: 'medal', star: 'star',
    'map-marker-alt': 'pin', 'location-dot': 'pin', 'map-marked-alt': 'pin', globe: 'globe',
    check: 'check', 'check-circle': 'checkCircle', 'circle-check': 'checkCircle', 'square-check': 'squareCheck', square: 'square',
    user: 'user', 'user-circle': 'user', 'circle-user': 'user', 'user-alt': 'user', 'user-large': 'user', 'user-tie': 'user', 'id-badge': 'badge', child: 'user', 'user-slash': 'user', 'user-gear': 'user',
    users: 'users', 'user-friends': 'users', 'users-cog': 'users', 'user-plus': 'userPlus', 'user-shield': 'shield',
    'arrow-up': 'arrowUp', sort: 'sort', 'circle-question': 'info', 'file-lines': 'file', 'layer-group': 'list',
    'arrow-left': 'arrowLeft', 'arrow-right': 'arrowRight', 'arrow-down': 'arrowDown', 'arrow-up-right-dots': 'chart',
    'chevron-down': 'chevronDown', 'chevron-right': 'chevronRight', 'chevron-left': 'chevronLeft', 'caret-down': 'caretDown',
    building: 'building', 'building-columns': 'building',
    bars: 'menu', 'sign-out-alt': 'logout', 'right-from-bracket': 'logout', 'sign-in-alt': 'login', 'right-to-bracket': 'login',
    'flag-checkered': 'flag', 'paper-plane': 'send', send: 'send',
    lock: 'lock', 'unlock-alt': 'unlock', 'lock-open': 'unlock', key: 'key',
    plus: 'plus', 'plus-circle': 'plusCircle', 'circle-plus': 'plusCircle',
    'info-circle': 'info', 'circle-info': 'info', info: 'info',
    'circle-notch': 'spinner', spinner: 'spinner',
    search: 'search', 'magnifying-glass': 'search', filter: 'filter',
    pen: 'pen', 'pen-fancy': 'pen', edit: 'pen', 'pen-to-square': 'pen', 'file-signature': 'pen',
    list: 'list', 'list-ol': 'list', 'table-list': 'list', 'list-check': 'listCheck', 'clipboard-list': 'listCheck',
    clock: 'clock', 'hourglass-half': 'hourglass', stopwatch: 'stopwatch', history: 'history',
    'triangle-exclamation': 'alert', 'exclamation-triangle': 'alert', 'exclamation-circle': 'alertCircle', 'circle-exclamation': 'alertCircle',
    'broadcast-tower': 'broadcast', 'tower-broadcast': 'broadcast', signal: 'signal',
    'calendar-alt': 'calendar', calendar: 'calendar', 'calendar-day': 'calendar', 'calendar-times': 'calendar',
    bolt: 'bolt', fire: 'fire',
    'floppy-disk': 'save', save: 'save',
    envelope: 'mail', 'envelope-open-text': 'mail',
    'code-branch': 'branch', 'project-diagram': 'branch',
    'clipboard-check': 'clipboard', 'table-columns': 'columns', table: 'columns', 'tachometer-alt': 'columns', grip: 'grip',
    home: 'home', house: 'home', print: 'print',
    'file-alt': 'file', 'file-pdf': 'file', 'file-export': 'download', 'file-excel': 'sheet', 'file-csv': 'sheet',
    'file-arrow-up': 'upload', 'file-upload': 'upload', upload: 'upload', 'cloud-arrow-up': 'upload', download: 'download',
    eye: 'eye', 'eye-slash': 'eyeOff',
    cogs: 'settings', cog: 'settings', gear: 'settings',
    'rupee-sign': 'rupee', 'indian-rupee-sign': 'rupee', 'credit-card': 'card', 'shopping-cart': 'card',
    rotate: 'refresh', 'sync-alt': 'refresh', 'rotate-right': 'refresh', 'rotate-left': 'refresh', redo: 'refresh',
    'external-link-alt': 'external', 'external-link-square-alt': 'external',
    bell: 'bell', 'trash-alt': 'trash', 'trash-can': 'trash', trash: 'trash',
    'chart-bar': 'chart', poll: 'chart', comments: 'chat', comment: 'chat',
    ban: 'ban', 'box-archive': 'archive', phone: 'phone', tag: 'tag', image: 'image', database: 'database',
    gavel: 'gavel', robot: 'bot', 'birthday-cake': 'cake', venus: 'gender', mars: 'gender',
    keyboard: 'keyboard', plug: 'plug', ellipsis: 'dots', circle: 'circle', 'ruler-combined': 'columns',
    'chalkboard-teacher': 'teacher', 'chalkboard-user': 'teacher', book: 'book',
  };

  const SPIN = /\b(fa-spin|fa-pulse)\b/;
  const svg = (name, extra) => {
    const body = P[name];
    if (!body) return '';
    return `<svg class="sf-icon${extra ? ' ' + extra : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
  };

  function nameOf(el) {
    for (const c of el.classList) {
      if (c.startsWith('fa-') && A[c.slice(3)]) return A[c.slice(3)];
    }
    return null;
  }

  function swap(el) {
    if (el.dataset.sfIcon) return;
    el.dataset.sfIcon = '1';
    const name = nameOf(el);
    const label = el.getAttribute('aria-label');
    if (!name) {
      // Unknown icon name: say so in the console, and in an icon-only button or link
      // draw a plain dot so the control never turns into an invisible empty box
      console.warn('[SwimFest] no icon for', el.className);
      const parent = el.parentElement;
      const iconOnly = parent && parent.matches('a, button') && !parent.textContent.trim();
      el.innerHTML = iconOnly ? '<svg class="sf-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/></svg>' : '';
    } else {
      el.innerHTML = svg(name, SPIN.test(el.className) ? 'is-spin' : '');
    }
    if (!label) el.setAttribute('aria-hidden', 'true');
    else el.setAttribute('role', 'img');
  }

  const SEL = 'i[class*="fa-"]';
  function scan(root) {
    if (root.nodeType !== 1) return;
    if (root.matches && root.matches(SEL)) swap(root);
    root.querySelectorAll && root.querySelectorAll(SEL).forEach(swap);
  }

  // Swap icons as soon as they appear (page scripts add many later)
  const mo = new MutationObserver(list => {
    for (const m of list) m.addedNodes.forEach(scan);
  });
  function start() {
    scan(document.documentElement);
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  // Some pages toggle icons by changing the class (e.g. eye ↔ eye-slash)
  const classMo = new MutationObserver(list => list.forEach(m => {
    if (m.target.matches && m.target.matches(SEL)) { delete m.target.dataset.sfIcon; swap(m.target); }
  }));
  document.addEventListener('DOMContentLoaded', () =>
    classMo.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true }));

  window.SF = window.SF || {};
  window.SF.icon = (name, extra) => svg(A[name] || name, extra);
})();
