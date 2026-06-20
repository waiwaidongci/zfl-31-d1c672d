const TemplateData = (function() {
  const _ = 0;
  const A = 1;
  const B = 2;
  const C = 3;
  const D = 4;

  const borders = [
    {
      id: "border-simple",
      name: "素面边框",
      category: "border",
      cols: 1,
      rows: 1,
      pattern: [[A]],
      isBorder: true
    },
    {
      id: "border-double",
      name: "双线边框",
      category: "border",
      cols: 2,
      rows: 2,
      pattern: [
        [A, A],
        [A, _]
      ],
      isBorder: true
    },
    {
      id: "border-dot",
      name: "点纹边框",
      category: "border",
      cols: 2,
      rows: 2,
      pattern: [
        [A, _],
        [_, A]
      ],
      isBorder: true
    },
    {
      id: "border-wave",
      name: "波浪边框",
      category: "border",
      cols: 4,
      rows: 2,
      pattern: [
        [_, A, A, _],
        [A, _, _, A]
      ],
      isBorder: true
    },
    {
      id: "border-geometric",
      name: "几何边框",
      category: "border",
      cols: 3,
      rows: 3,
      pattern: [
        [A, A, A],
        [A, _, A],
        [A, A, A]
      ],
      isBorder: true
    },
    {
      id: "border-flower",
      name: "花角边框",
      category: "border",
      cols: 5,
      rows: 5,
      pattern: [
        [A, _, A, _, A],
        [_, A, A, A, _],
        [A, A, _, A, A],
        [_, A, A, A, _],
        [A, _, A, _, A]
      ],
      isCorner: true
    }
  ];

  const centerFlowers = [
    {
      id: "flower-dot",
      name: "点心花",
      category: "center",
      cols: 3,
      rows: 3,
      pattern: [
        [_, A, _],
        [A, B, A],
        [_, A, _]
      ]
    },
    {
      id: "flower-four",
      name: "四瓣花",
      category: "center",
      cols: 5,
      rows: 5,
      pattern: [
        [_, _, A, _, _],
        [_, A, B, A, _],
        [A, B, C, B, A],
        [_, A, B, A, _],
        [_, _, A, _, _]
      ]
    },
    {
      id: "flower-eight",
      name: "八瓣花",
      category: "center",
      cols: 7,
      rows: 7,
      pattern: [
        [_, _, _, A, _, _, _],
        [_, _, A, B, A, _, _],
        [_, A, B, C, B, A, _],
        [A, B, C, D, C, B, A],
        [_, A, B, C, B, A, _],
        [_, _, A, B, A, _, _],
        [_, _, _, A, _, _, _]
      ]
    },
    {
      id: "flower-diamond",
      name: "菱形花",
      category: "center",
      cols: 5,
      rows: 5,
      pattern: [
        [_, _, A, _, _],
        [_, A, A, A, _],
        [A, A, B, A, A],
        [_, A, A, A, _],
        [_, _, A, _, _]
      ]
    },
    {
      id: "flower-star",
      name: "星花纹",
      category: "center",
      cols: 7,
      rows: 7,
      pattern: [
        [_, _, _, A, _, _, _],
        [_, _, A, A, A, _, _],
        [_, A, _, B, _, A, _],
        [A, A, B, C, B, A, A],
        [_, A, _, B, _, A, _],
        [_, _, A, A, A, _, _],
        [_, _, _, A, _, _, _]
      ]
    },
    {
      id: "flower-cross",
      name: "十字宝相",
      category: "center",
      cols: 7,
      rows: 7,
      pattern: [
        [_, _, A, B, A, _, _],
        [_, _, A, B, A, _, _],
        [A, A, A, B, A, A, A],
        [B, B, B, C, B, B, B],
        [A, A, A, B, A, A, A],
        [_, _, A, B, A, _, _],
        [_, _, A, B, A, _, _]
      ]
    }
  ];

  const geometries = [
    {
      id: "geo-diamond",
      name: "菱形纹",
      category: "geo",
      cols: 4,
      rows: 4,
      pattern: [
        [_, _, A, _],
        [_, A, B, A],
        [A, B, A, _],
        [_, A, _, _]
      ],
      repeatable: true
    },
    {
      id: "geo-square",
      name: "回字纹",
      category: "geo",
      cols: 6,
      rows: 6,
      pattern: [
        [A, A, A, A, A, A],
        [A, _, _, _, _, A],
        [A, _, A, A, _, A],
        [A, _, A, A, _, A],
        [A, _, _, _, _, A],
        [A, A, A, A, A, A]
      ],
      repeatable: true
    },
    {
      id: "geo-triangle",
      name: "三角纹",
      category: "geo",
      cols: 5,
      rows: 4,
      pattern: [
        [_, _, A, _, _],
        [_, A, B, A, _],
        [A, B, A, B, A],
        [A, A, A, A, A]
      ],
      repeatable: true
    },
    {
      id: "geo-wave",
      name: "波浪纹",
      category: "geo",
      cols: 6,
      rows: 3,
      pattern: [
        [_, A, A, _, _, _],
        [A, _, _, A, A, _],
        [_, _, _, _, _, A]
      ],
      repeatable: true
    },
    {
      id: "geo-checker",
      name: "棋格纹",
      category: "geo",
      cols: 4,
      rows: 4,
      pattern: [
        [A, _, A, _],
        [_, A, _, A],
        [A, _, A, _],
        [_, A, _, A]
      ],
      repeatable: true
    },
    {
      id: "geo-honeycomb",
      name: "蜂巢纹",
      category: "geo",
      cols: 6,
      rows: 4,
      pattern: [
        [_, A, A, _, _, _],
        [A, A, A, A, _, _],
        [_, A, A, _, A, A],
        [_, _, _, A, A, A]
      ],
      repeatable: true
    },
    {
      id: "geo-swastika",
      name: "万字纹",
      category: "geo",
      cols: 5,
      rows: 5,
      pattern: [
        [A, _, _, _, A],
        [A, A, _, A, A],
        [_, A, A, A, _],
        [A, A, _, A, A],
        [A, _, _, _, A]
      ],
      repeatable: false
    }
  ];

  const grounds = [
    {
      id: "ground-blank",
      name: "素地",
      category: "ground",
      cols: 1,
      rows: 1,
      pattern: [[_]],
      isGround: true
    },
    {
      id: "ground-solid",
      name: "满铺地",
      category: "ground",
      cols: 1,
      rows: 1,
      pattern: [[A]],
      isGround: true
    },
    {
      id: "ground-dot",
      name: "点地纹",
      category: "ground",
      cols: 3,
      rows: 3,
      pattern: [
        [_, _, _],
        [_, A, _],
        [_, _, _]
      ],
      isGround: true,
      repeatable: true
    },
    {
      id: "ground-line",
      name: "线地纹",
      category: "ground",
      cols: 4,
      rows: 4,
      pattern: [
        [A, _, _, _],
        [_, A, _, _],
        [_, _, A, _],
        [_, _, _, A]
      ],
      isGround: true,
      repeatable: true
    },
    {
      id: "ground-grid",
      name: "网格地",
      category: "ground",
      cols: 4,
      rows: 4,
      pattern: [
        [A, A, A, A],
        [A, _, _, A],
        [A, _, _, A],
        [A, A, A, A]
      ],
      isGround: true,
      repeatable: true
    }
  ];

  const allTemplates = [...borders, ...centerFlowers, ...geometries, ...grounds];

  function getByCategory(category) {
    switch (category) {
      case "border": return borders;
      case "center": return centerFlowers;
      case "geo": return geometries;
      case "ground": return grounds;
      default: return allTemplates;
    }
  }

  function getById(id) {
    return allTemplates.find(t => t.id === id);
  }

  function getAll() {
    return allTemplates;
  }

  function getCategories() {
    return [
      { id: "border", name: "边框" },
      { id: "center", name: "中心花" },
      { id: "geo", name: "几何纹" },
      { id: "ground", name: "底纹" }
    ];
  }

  return {
    getByCategory,
    getById,
    getAll,
    getCategories
  };
})();
