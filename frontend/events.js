/* ============================================================
   SwimFest – race list shared by Register and the player list
   Every individual race a swimmer can enter, by gender and age
   group. A meet can switch some off (tournaments.events_offered).
   The 100m Individual Medley is separate: it's an optional extra
   on top of the 3 individual races.
   ============================================================ */
window.SWIMFEST_EVENT_MASTER = [
  // ── U-10 Boys ──
  { id:'e1',  gender:'Boy',  category:'U-10', name:'25m Freestyle'     },
  { id:'e2',  gender:'Boy',  category:'U-10', name:'50m Freestyle'     },
  { id:'e3',  gender:'Boy',  category:'U-10', name:'25m Backstroke'    },
  { id:'e4',  gender:'Boy',  category:'U-10', name:'50m Backstroke'    },
  { id:'e5',  gender:'Boy',  category:'U-10', name:'25m Breaststroke'  },
  { id:'e6',  gender:'Boy',  category:'U-10', name:'50m Breaststroke'  },
  { id:'e7',  gender:'Boy',  category:'U-10', name:'25m Butterfly'     },
  { id:'e8',  gender:'Boy',  category:'U-10', name:'50m Butterfly'     },

  // ── U-10 Girls ──
  { id:'e9',  gender:'Girl', category:'U-10', name:'25m Freestyle'     },
  { id:'e10', gender:'Girl', category:'U-10', name:'50m Freestyle'     },
  { id:'e11', gender:'Girl', category:'U-10', name:'25m Backstroke'    },
  { id:'e12', gender:'Girl', category:'U-10', name:'50m Backstroke'    },
  { id:'e13', gender:'Girl', category:'U-10', name:'25m Breaststroke'  },
  { id:'e14', gender:'Girl', category:'U-10', name:'50m Breaststroke'  },
  { id:'e15', gender:'Girl', category:'U-10', name:'25m Butterfly'     },
  { id:'e16', gender:'Girl', category:'U-10', name:'50m Butterfly'     },

  // ── U-12 Boys ──
  { id:'e17', gender:'Boy',  category:'U-12', name:'50m Freestyle'     },
  { id:'e18', gender:'Boy',  category:'U-12', name:'100m Freestyle'    },
  { id:'e19', gender:'Boy',  category:'U-12', name:'200m Freestyle'    },
  { id:'e20', gender:'Boy',  category:'U-12', name:'50m Backstroke'    },
  { id:'e21', gender:'Boy',  category:'U-12', name:'100m Backstroke'   },
  { id:'e22', gender:'Boy',  category:'U-12', name:'50m Breaststroke'  },
  { id:'e23', gender:'Boy',  category:'U-12', name:'100m Breaststroke' },
  { id:'e24', gender:'Boy',  category:'U-12', name:'50m Butterfly'     },
  { id:'e25', gender:'Boy',  category:'U-12', name:'100m Butterfly'    },

  // ── U-12 Girls ──
  { id:'e26', gender:'Girl', category:'U-12', name:'50m Freestyle'     },
  { id:'e27', gender:'Girl', category:'U-12', name:'100m Freestyle'    },
  { id:'e28', gender:'Girl', category:'U-12', name:'200m Freestyle'    },
  { id:'e29', gender:'Girl', category:'U-12', name:'50m Backstroke'    },
  { id:'e30', gender:'Girl', category:'U-12', name:'100m Backstroke'   },
  { id:'e31', gender:'Girl', category:'U-12', name:'50m Breaststroke'  },
  { id:'e32', gender:'Girl', category:'U-12', name:'100m Breaststroke' },
  { id:'e33', gender:'Girl', category:'U-12', name:'50m Butterfly'     },
  { id:'e34', gender:'Girl', category:'U-12', name:'100m Butterfly'    },

  // ── U-14 Boys ──
  { id:'e35', gender:'Boy',  category:'U-14', name:'50m Freestyle'     },
  { id:'e36', gender:'Boy',  category:'U-14', name:'100m Freestyle'    },
  { id:'e37', gender:'Boy',  category:'U-14', name:'200m Freestyle'    },
  { id:'e38', gender:'Boy',  category:'U-14', name:'50m Backstroke'    },
  { id:'e39', gender:'Boy',  category:'U-14', name:'100m Backstroke'   },
  { id:'e40', gender:'Boy',  category:'U-14', name:'200m Backstroke'   },
  { id:'e41', gender:'Boy',  category:'U-14', name:'50m Breaststroke'  },
  { id:'e42', gender:'Boy',  category:'U-14', name:'100m Breaststroke' },
  { id:'e43', gender:'Boy',  category:'U-14', name:'200m Breaststroke' },
  { id:'e44', gender:'Boy',  category:'U-14', name:'50m Butterfly'     },
  { id:'e45', gender:'Boy',  category:'U-14', name:'100m Butterfly'    },

  // ── U-14 Girls ──
  { id:'e46', gender:'Girl', category:'U-14', name:'50m Freestyle'     },
  { id:'e47', gender:'Girl', category:'U-14', name:'100m Freestyle'    },
  { id:'e48', gender:'Girl', category:'U-14', name:'200m Freestyle'    },
  { id:'e49', gender:'Girl', category:'U-14', name:'50m Backstroke'    },
  { id:'e50', gender:'Girl', category:'U-14', name:'100m Backstroke'   },
  { id:'e51', gender:'Girl', category:'U-14', name:'200m Backstroke'   },
  { id:'e52', gender:'Girl', category:'U-14', name:'50m Breaststroke'  },
  { id:'e53', gender:'Girl', category:'U-14', name:'100m Breaststroke' },
  { id:'e54', gender:'Girl', category:'U-14', name:'200m Breaststroke' },
  { id:'e55', gender:'Girl', category:'U-14', name:'50m Butterfly'     },
  { id:'e56', gender:'Girl', category:'U-14', name:'100m Butterfly'    },

  // ── U-16 Boys ──
  { id:'e57', gender:'Boy',  category:'U-16', name:'50m Freestyle'     },
  { id:'e58', gender:'Boy',  category:'U-16', name:'100m Freestyle'    },
  { id:'e59', gender:'Boy',  category:'U-16', name:'200m Freestyle'    },
  { id:'e60', gender:'Boy',  category:'U-16', name:'50m Backstroke'    },
  { id:'e61', gender:'Boy',  category:'U-16', name:'100m Backstroke'   },
  { id:'e62', gender:'Boy',  category:'U-16', name:'200m Backstroke'   },
  { id:'e63', gender:'Boy',  category:'U-16', name:'50m Breaststroke'  },
  { id:'e64', gender:'Boy',  category:'U-16', name:'100m Breaststroke' },
  { id:'e65', gender:'Boy',  category:'U-16', name:'200m Breaststroke' },
  { id:'e66', gender:'Boy',  category:'U-16', name:'50m Butterfly'     },
  { id:'e67', gender:'Boy',  category:'U-16', name:'100m Butterfly'    },

  // ── U-16 Girls ──
  { id:'e68', gender:'Girl', category:'U-16', name:'50m Freestyle'     },
  { id:'e69', gender:'Girl', category:'U-16', name:'100m Freestyle'    },
  { id:'e70', gender:'Girl', category:'U-16', name:'200m Freestyle'    },
  { id:'e71', gender:'Girl', category:'U-16', name:'50m Backstroke'    },
  { id:'e72', gender:'Girl', category:'U-16', name:'100m Backstroke'   },
  { id:'e73', gender:'Girl', category:'U-16', name:'200m Backstroke'   },
  { id:'e74', gender:'Girl', category:'U-16', name:'50m Breaststroke'  },
  { id:'e75', gender:'Girl', category:'U-16', name:'100m Breaststroke' },
  { id:'e76', gender:'Girl', category:'U-16', name:'200m Breaststroke' },
  { id:'e77', gender:'Girl', category:'U-16', name:'50m Butterfly'     },
  { id:'e78', gender:'Girl', category:'U-16', name:'100m Butterfly'    },
];
