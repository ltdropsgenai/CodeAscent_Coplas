/**
 * Latin American scene backdrops for the animated background.
 *
 * A single scene is shown per screen (picked by route in AppBackground) with
 * Ken Burns motion + bokeh — never a rotating slideshow. Spread across the
 * region (13 countries, 34 scenes) so the backdrop never feels repetitive.
 *
 * MOBILE-FIRST: these are 9:16 PORTRAIT renders (768×1376) so they frame
 * correctly full-bleed on phones (AppBackground uses resizeMode "cover"). On
 * wide desktop web they center-crop horizontally — acceptable, web is secondary.
 *
 * BUNDLED offline: local PNGs under assets/scenes/, loaded via require().
 * (Rebuilt by scripts/fetch-scenes.mjs from the generated CDN previews.)
 */

export const SCENES: Array<string | number> = [
  // ── Mexico (home of the deck) ──
  require('../../assets/scenes/hf_20260729_003847_4058cb18-5850-4c78-b0c0-22d9c0529eee.png'), // Día de Muertos night, marigold arches + cathedral
  require('../../assets/scenes/hf_20260729_003858_0c767f1f-e4ef-400b-9d5d-27acde99eaf0.png'), // Mexican plaza at night, kiosk + string lights
  require('../../assets/scenes/hf_20260729_003849_a82780e4-bb02-4e46-9c34-b5ee0c5748f5.png'), // Guanajuato colorful hillside, dusk
  // ── Guatemala ──
  require('../../assets/scenes/hf_20260729_004008_324ccf69-21cf-4cdc-a928-129ea7755715.png'), // Antigua, Santa Catalina arch + Agua volcano
  require('../../assets/scenes/hf_20260729_004011_be3bb945-8ce0-44ce-9d46-b6b43d5a730a.png'), // Lake Atitlán at sunset
  // ── Dominican Republic ──
  require('../../assets/scenes/hf_20260729_004013_243ea9db-bda1-41f7-aaad-51c66cb88e73.png'), // Santo Domingo Zona Colonial
  require('../../assets/scenes/hf_20260729_004016_3a8e089b-2a5c-4e2b-b933-f10e79180b27.png'), // DR Caribbean coastal village, golden hour
  require('../../assets/scenes/hf_20260729_004748_48ed4b76-28f3-4187-b79c-8f51865a5741.png'), // Puerto Plata Victorian gingerbread houses
  require('../../assets/scenes/hf_20260729_004751_6ae99c97-013a-4f00-bbdf-b0ccf896d598.png'), // Los Haitises karst islands + turquoise bay
  // ── Cuba ──
  require('../../assets/scenes/hf_20260729_004018_9f5adbef-b1d2-41e3-b97e-eb310ccbc80c.png'), // Old Havana street + classic car, dusk
  require('../../assets/scenes/hf_20260729_004021_8070983f-7ba2-4e71-9b7d-1d58e5424f8c.png'), // Trinidad colonial street + bell tower
  // ── Puerto Rico ──
  require('../../assets/scenes/hf_20260729_004024_0b077973-6c03-4900-aa32-df8f31aba015.png'), // Old San Juan, blue cobblestones
  require('../../assets/scenes/hf_20260729_004026_bf84d8b7-0d20-4b70-9a18-14cda2f889f5.png'), // El Morro fortress, golden hour
  require('../../assets/scenes/hf_20260729_004754_5f408953-cda1-4e69-974c-08f598f87081.png'), // Calle Fortaleza umbrella street
  require('../../assets/scenes/hf_20260729_004757_3688147c-0432-46ef-98c2-d41be7c96650.png'), // El Yunque rainforest waterfall
  // ── Colombia ──
  require('../../assets/scenes/hf_20260729_004029_d9f3d1c4-f6c9-41ca-9c83-2e73830601c4.png'), // Cartagena walled city, bougainvillea
  require('../../assets/scenes/hf_20260729_004032_10176473-1a0a-492b-a2f9-ed2cc8981697.png'), // Guatapé colorful zócalo street
  // ── Venezuela ──
  require('../../assets/scenes/hf_20260729_004036_11fcf1f5-43c5-4ee7-8b31-08e26a48fc29.png'), // Angel Falls / tepui
  require('../../assets/scenes/hf_20260729_004038_3d06c0d1-87f8-4f7e-8724-ba7ef3d1b527.png'), // Los Roques turquoise lagoon
  // ── Ecuador ──
  require('../../assets/scenes/hf_20260729_004047_9d83f519-a269-4fa4-9890-2fad616af1de.png'), // Quito old town + Andes
  require('../../assets/scenes/hf_20260729_004050_6997da8a-15a1-44d9-babf-632af0ca4ff8.png'), // Cotopaxi volcano, sunset
  // ── Peru ──
  require('../../assets/scenes/hf_20260729_004052_1555a4b1-c2f7-46e5-85c2-49c0753bc5aa.png'), // Machu Picchu, golden hour
  require('../../assets/scenes/hf_20260729_004055_8e3894d8-0b8f-4eaa-b219-3aafbff15b36.png'), // Cusco Plaza de Armas, dusk
  // ── Bolivia ──
  require('../../assets/scenes/hf_20260729_004058_35919622-9518-4b0f-ad42-4884b96fb1f6.png'), // Salar de Uyuni mirror, sunset
  require('../../assets/scenes/hf_20260729_004101_99fc44c2-3227-4129-94d7-9794efadc6bd.png'), // La Paz + Illimani, dusk
  // ── Chile ──
  require('../../assets/scenes/hf_20260729_004103_61505f95-1dec-410a-9b2c-72613a047632.png'), // Valparaíso hillside + funicular
  require('../../assets/scenes/hf_20260729_004106_01e14e44-c9a4-4166-9d42-f651fe60c3a9.png'), // Torres del Paine, golden hour
  require('../../assets/scenes/hf_20260729_004759_585b2b26-f52e-42c3-b319-1bb5c84b1908.png'), // Atacama Valle de la Luna, sunset
  require('../../assets/scenes/hf_20260729_004802_8518e6d7-c0bd-433e-9bd3-8e63b1066005.png'), // Chiloé palafito stilt houses
  // ── Argentina ──
  require('../../assets/scenes/hf_20260729_004108_f895a3e1-779f-4fb9-87e6-a9582e58de42.png'), // La Boca / Caminito, Buenos Aires
  require('../../assets/scenes/hf_20260729_004111_c3cdf086-f203-4fe3-b779-06a43755803d.png'), // Mount Fitz Roy, Patagonia
  // ── Brazil ──
  require('../../assets/scenes/hf_20260729_004805_2c9c6f61-63df-4e1a-be74-35acf86e34aa.png'), // Rio de Janeiro, Christ + Sugarloaf, golden hour
  require('../../assets/scenes/hf_20260729_004808_87f09115-a25a-454e-b38b-292842e06563.png'), // Pelourinho, Salvador da Bahia
  require('../../assets/scenes/hf_20260729_004810_15333d19-539d-4fc0-b820-3a2bd9bd4504.png'), // Iguaçu Falls
];
