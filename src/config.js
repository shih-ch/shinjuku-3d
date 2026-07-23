// 場景原點（與 tools/convert_indoor.py 的 ORIGIN 一致，勿單獨修改）
export const ORIGIN_LON = 139.7005;
export const ORIGIN_LAT = 35.6900;

// 新宿站地面在 WGS84 橢球上的高度：標高 37.5m（GSI DEM）+ 大地水準面差約 36.7m
export const GROUND_ELLIPSOIDAL_H = 74.2;

export const TILESETS = {
  bldg: {
    label: '地面建築 PLATEAU LOD2（新宿区）',
    url: 'https://assets.cms.plateau.reearth.io/assets/2f/d4f9a7-13ad-43cb-b984-033803199eab/13104_shinjuku-ku_pref_2025_citygml_1_op_bldg_3dtiles_13104_shinjuku-ku_lod2_no_texture/tileset.json',
  },
  bldgShibuya: {
    label: '地面建築 PLATEAU LOD2（渋谷区）',
    url: 'https://assets.cms.plateau.reearth.io/assets/4c/92c509-8082-47cb-9c0c-cab712d49dbd/13113_shibuya-ku_pref_2025_citygml_1_op_bldg_3dtiles_13113_shibuya-ku_lod2_no_texture/tileset.json',
  },
  ubld: {
    label: '地下街 PLATEAU LOD4',
    url: 'https://assets.cms.plateau.reearth.io/assets/7d/d6f2c5-80ca-4c58-ac34-a67de3786d04/13104_shinjuku-ku_pref_2025_citygml_1_op_ubld_3dtiles_lod4/tileset.json',
  },
};

// 各樓層基準高度（公尺，實寸；樓層分離滑桿會乘上倍率）
export const LEVEL_ELEV = {
  B3: -22, B2: -13.5, B1: -6.5,
  0: -0.35, 1: 0,
  2: 7, '2out': 7,
  3: 13.5, '3out': 13.5,
  4: 20, '4out': 20,
};

// 物理空間 category → { 名稱, 顏色, 擠出高度 }（依地物凡例 平成30年3月版）
export const SPACE_CATS = {
  B001: { label: '商業設施', color: 0xf2b268, h: 2.4 },
  B002: { label: '事務所', color: 0xcfc3a8, h: 2.4 },
  B003: { label: '公共設施', color: 0xc9d3a8, h: 2.4 },
  B004: { label: '候車室・休憩所', color: 0xe3d18e, h: 2.4 },
  B005: { label: '售票處', color: 0x8fcf9a, h: 2.4 },
  B006: { label: '詢問處・導引', color: 0x93c9c1, h: 2.4 },
  B007: { label: '廁所（男）', color: 0x5f9fb8, h: 2.4 },
  B008: { label: '廁所（女）', color: 0xd98fb0, h: 2.4 },
  B010: { label: '廁所', color: 0x6fb3c4, h: 2.4 },
  B011: { label: '多功能廁所', color: 0x9a7fc4, h: 2.4 },
  B016: { label: '哺乳室', color: 0xe8b9c9, h: 2.4 },
  B018: { label: '站務室', color: 0xb8a98e, h: 2.4 },
  B019: { label: '其他房間', color: 0xe6ddc4, h: 2.4 },
  B021: { label: '樓梯', color: 0xa9cde8, h: 1.0 },
  B022: { label: '電梯', color: 0xf4e3a1, h: 2.8 },
  B023: { label: '手扶梯', color: 0xf0c069, h: 1.0 },
  B025: { label: '坡道', color: 0xcbd6de, h: 0.4 },
  B029: { label: '通路／大廳', color: 0xb7a8e6, h: 0.28 },
  B030: { label: '人行天橋・平台', color: 0xa9b6c9, h: 0.28 },
  default: { label: '未分類', color: 0xddd4bd, h: 0.6 },
};

// 「改札內強調」模式
export const TOLL_COLORS = {
  paid: 0xe06a4f,   // toll=1 收費區（改札內）
  free: 0xd9d2bd,   // 其他
};

export const PALETTE = {
  paper: 0xf2ecd9,
  ground: 0xe9e2cc,
  floorPlate: 0xefe7d2,
  floorEdge: 0x6b6250,
  fixture: 0xa89f8d,
  opening: 0xd633c8,
  building: 0xf7f2e4,
};
