/**
 * Coplas deck-expansion generator.
 *
 * Authors the expanded deck as curated Spanish sub-theme pools (theme + 4–7
 * depictable concepts each), then emits:
 *   • coplas-expansion-cards.json   — {id,name,number,family,emoji} per card
 *   • coplas-expansion-groups.json  — {kind:'cat',cards[4],theme,why} groups
 *   • coplas-expansion-prompts.json — {id -> photoreal art prompt}
 *
 * Design rules that keep it valid for the composer:
 *   • Pools are ≤7 cards, so any two 4-card groups drawn from the SAME pool
 *     necessarily overlap → the composer (which picks card-disjoint groups)
 *     can never place two same-theme groups in one round.
 *   • A concept repeated across DIFFERENT pools is intentional overlap (the
 *     Connections "trap" flavor) and dedupes to one card in many groups.
 *   • Every group is kind 'cat'. Letter/rhyme/color traps stay with the base
 *     54 for now (expansion traps are a follow-up) — noted in the plan.
 *
 * Art: every card gets a photoreal prompt in the house style. `emoji` is set to
 * a neutral card-back placeholder '🃏' (never shipped — release gates on 100%
 * art coverage; the online path shows a branded placeholder, not a glyph).
 */

const STYLE =
  'photoreal, a real detailed depiction, single subject centered, warm golden-amber studio backdrop with a soft radial spotlight glow behind it, rich warm cinematic lighting, subtle gold rim light, deep warm shadows, 3:4 vertical, no text, no border, no frame';

// macro-family -> [ {theme, why, cards:["Nombre|english gloss", ...]} ]
const POOLS = {
  frutas: [
    { theme: 'Cítricos', why: 'Naranja, limón, lima y toronja: puros cítricos.', cards: ['La Naranja|an orange', 'El Limón|a lemon', 'La Lima|a lime', 'La Toronja|a grapefruit', 'La Mandarina|a mandarin orange'] },
    { theme: 'Frutas rojas', why: 'Fresa, cereza, frambuesa y granada: rojas y dulces.', cards: ['La Fresa|a strawberry', 'La Cereza|a cherry', 'La Frambuesa|a raspberry', 'La Granada|a pomegranate', 'La Mora|a blackberry'] },
    { theme: 'Tropicales', why: 'Mango, piña, papaya y coco: del trópico.', cards: ['El Mango|a mango', 'La Piña|a pineapple', 'La Papaya|a papaya', 'El Coco|a coconut', 'El Maracuyá|a passion fruit'] },
    { theme: 'De hueso', why: 'Durazno, ciruela, chabacano y aguacate: traen hueso.', cards: ['El Durazno|a peach', 'La Ciruela|a plum', 'El Chabacano|an apricot', 'El Aguacate|an avocado', 'El Dátil|a date fruit'] },
    { theme: 'De racimo y parra', why: 'Uva, plátano, higo y kiwi.', cards: ['La Uva|a bunch of grapes', 'El Plátano|a banana', 'El Higo|a fig', 'El Kiwi|a kiwi fruit', 'El Melón|a melon'] },
    { theme: 'Manzanas y peras', why: 'Manzana, pera, membrillo y sandía.', cards: ['La Manzana|a red apple', 'La Pera|a pear', 'El Membrillo|a quince', 'La Sandía|a watermelon', 'La Guayaba|a guava'] },
  ],
  verduras: [
    { theme: 'De la tierra', why: 'Papa, zanahoria, betabel y rábano: raíces.', cards: ['La Papa|a potato', 'La Zanahoria|a carrot', 'El Betabel|a beet', 'El Rábano|a radish', 'El Camote|a sweet potato'] },
    { theme: 'Verduras verdes', why: 'Lechuga, brócoli, ejote y espinaca.', cards: ['La Lechuga|a head of lettuce', 'El Brócoli|broccoli', 'El Ejote|green beans', 'La Espinaca|spinach', 'El Pepino|a cucumber'] },
    { theme: 'Picantes y bulbos', why: 'Chile, cebolla, ajo y jengibre.', cards: ['El Chile|a chili pepper', 'La Cebolla|an onion', 'El Ajo|a garlic bulb', 'El Jengibre|ginger root', 'El Pimiento|a bell pepper'] },
    { theme: 'De guiso', why: 'Jitomate, calabaza, elote y berenjena.', cards: ['El Jitomate|a tomato', 'La Calabaza|a pumpkin', 'El Elote|an ear of corn', 'La Berenjena|an eggplant', 'El Champiñón|a mushroom'] },
    { theme: 'Legumbres', why: 'Frijol, chícharo, lenteja y garbanzo.', cards: ['El Frijol|beans', 'El Chícharo|peas', 'La Lenteja|lentils', 'El Garbanzo|chickpeas', 'El Haba|fava beans'] },
  ],
  granja: [
    { theme: 'Ganado', why: 'Vaca, toro, caballo y burro.', cards: ['La Vaca|a dairy cow', 'El Toro|a bull', 'El Caballo|a horse', 'El Burro|a donkey', 'La Cabra|a goat'] },
    { theme: 'Corral', why: 'Cerdo, oveja, gallina y pavo.', cards: ['El Cerdo|a pig', 'La Oveja|a sheep', 'La Gallina|a hen', 'El Pavo|a turkey', 'El Ganso|a goose'] },
    { theme: 'Crías', why: 'Pollito, becerro, potro y cordero.', cards: ['El Pollito|a chick', 'El Becerro|a calf', 'El Potro|a foal', 'El Cordero|a lamb', 'El Cochinito|a piglet'] },
  ],
  aves: [
    { theme: 'De rapiña', why: 'Águila, halcón, búho y lechuza.', cards: ['El Águila|an eagle', 'El Halcón|a falcon', 'El Búho|an owl', 'La Lechuza|a barn owl', 'El Zopilote|a vulture'] },
    { theme: 'Coloridas', why: 'Guacamaya, tucán, colibrí y flamenco.', cards: ['La Guacamaya|a macaw', 'El Tucán|a toucan', 'El Colibrí|a hummingbird', 'El Flamenco|a flamingo', 'El Pavorreal|a peacock'] },
    { theme: 'De agua', why: 'Pato, cisne, pelícano y gaviota.', cards: ['El Pato|a duck', 'El Cisne|a swan', 'El Pelícano|a pelican', 'La Gaviota|a seagull', 'La Garza|a heron'] },
    { theme: 'Aves de jardín', why: 'Gorrión, paloma, cuervo y golondrina.', cards: ['El Gorrión|a sparrow', 'La Paloma|a dove', 'El Cuervo|a crow', 'La Golondrina|a swallow', 'El Petirrojo|a robin'] },
    { theme: 'Aves grandes', why: 'Avestruz, cigüeña, grulla y cóndor.', cards: ['El Avestruz|an ostrich', 'La Cigüeña|a stork', 'La Grulla|a crane bird', 'El Cóndor|a condor', 'El Pingüino|a penguin'] },
  ],
  mamiferos: [
    { theme: 'Felinos', why: 'León, tigre, leopardo y jaguar.', cards: ['El León|a lion', 'El Tigre|a tiger', 'El Leopardo|a leopard', 'El Jaguar|a jaguar', 'La Pantera|a black panther'] },
    { theme: 'Bestias grandes', why: 'Elefante, jirafa, rinoceronte e hipopótamo.', cards: ['El Elefante|an elephant', 'La Jirafa|a giraffe', 'El Rinoceronte|a rhinoceros', 'El Hipopótamo|a hippo', 'El Búfalo|a buffalo'] },
    { theme: 'Del bosque', why: 'Oso, lobo, zorro y venado.', cards: ['El Oso|a brown bear', 'El Lobo|a wolf', 'El Zorro|a fox', 'El Venado|a deer', 'El Mapache|a raccoon'] },
    { theme: 'Primates y trepadores', why: 'Mono, gorila, perezoso y koala.', cards: ['El Mono|a monkey', 'El Gorila|a gorilla', 'El Perezoso|a sloth', 'El Koala|a koala', 'La Ardilla|a squirrel'] },
    { theme: 'Domésticos', why: 'Perro, gato, conejo y hámster.', cards: ['El Perro|a dog', 'El Gato|a cat', 'El Conejo|a rabbit', 'El Hámster|a hamster', 'El Hurón|a ferret'] },
    { theme: 'Del frío y desierto', why: 'Camello, foca, morsa y canguro.', cards: ['El Camello|a camel', 'La Foca|a seal', 'La Morsa|a walrus', 'El Canguro|a kangaroo', 'El Erizo|a hedgehog'] },
  ],
  mar: [
    { theme: 'Peces', why: 'Tiburón, atún, pez espada y mero.', cards: ['El Tiburón|a shark', 'El Atún|a tuna', 'El Pez Espada|a swordfish', 'El Mero|a grouper fish', 'La Sardina|a sardine'] },
    { theme: 'Mariscos', why: 'Camarón, cangrejo, langosta y almeja.', cards: ['El Camarón|a shrimp', 'El Cangrejo|a crab', 'La Langosta|a lobster', 'La Almeja|a clam', 'El Ostión|an oyster'] },
    { theme: 'Del fondo', why: 'Pulpo, calamar, medusa y caballito.', cards: ['El Pulpo|an octopus', 'El Calamar|a squid', 'La Medusa|a jellyfish', 'El Caballito de Mar|a seahorse', 'La Estrella de Mar|a starfish'] },
    { theme: 'Gigantes', why: 'Ballena, delfín, tortuga y foca.', cards: ['La Ballena|a whale', 'El Delfín|a dolphin', 'La Tortuga|a sea turtle', 'La Raya|a stingray', 'La Orca|an orca'] },
  ],
  bichos: [
    { theme: 'Voladores', why: 'Mariposa, abeja, libélula y mosca.', cards: ['La Mariposa|a butterfly', 'La Abeja|a bee', 'La Libélula|a dragonfly', 'La Mosca|a housefly', 'El Mosquito|a mosquito'] },
    { theme: 'Rastreros', why: 'Hormiga, escarabajo, oruga y caracol.', cards: ['La Hormiga|an ant', 'El Escarabajo|a beetle', 'La Oruga|a caterpillar', 'El Caracol|a snail', 'La Cucaracha|a cockroach'] },
    { theme: 'Con aguijón', why: 'Araña, alacrán, avispa y ciempiés.', cards: ['La Araña|a spider', 'El Alacrán|a scorpion', 'La Avispa|a wasp', 'El Ciempiés|a centipede', 'La Garrapata|a tick'] },
    { theme: 'De la noche', why: 'Luciérnaga, grillo, polilla y saltamontes.', cards: ['La Luciérnaga|a firefly', 'El Grillo|a cricket', 'La Polilla|a moth', 'El Saltamontes|a grasshopper', 'La Chinche|a bedbug'] },
  ],
  reptiles: [
    { theme: 'Reptiles', why: 'Serpiente, lagarto, iguana y camaleón.', cards: ['La Serpiente|a snake', 'El Lagarto|a lizard', 'La Iguana|an iguana', 'El Camaleón|a chameleon', 'El Cocodrilo|a crocodile'] },
    { theme: 'Anfibios y lentos', why: 'Rana, sapo, tortuga y salamandra.', cards: ['La Rana|a frog', 'El Sapo|a toad', 'La Tortuga|a tortoise', 'La Salamandra|a salamander', 'El Ajolote|an axolotl'] },
  ],
  herramientas: [
    { theme: 'De golpe y corte', why: 'Martillo, hacha, serrucho y cincel.', cards: ['El Martillo|a hammer', 'El Hacha|an axe', 'El Serrucho|a hand saw', 'El Cincel|a chisel', 'El Mazo|a mallet'] },
    { theme: 'De apretar', why: 'Desarmador, llave, pinzas y taladro.', cards: ['El Desarmador|a screwdriver', 'La Llave Inglesa|a wrench', 'Las Pinzas|pliers', 'El Taladro|a power drill', 'La Tuerca|a nut and bolt'] },
    { theme: 'Para el jardín', why: 'Pala, rastrillo, azadón y regadera.', cards: ['La Pala|a shovel', 'El Rastrillo|a rake', 'El Azadón|a hoe', 'La Regadera|a watering can', 'La Carretilla|a wheelbarrow'] },
    { theme: 'De medir y sujetar', why: 'Metro, nivel, clavo y tornillo.', cards: ['El Metro|a tape measure', 'El Nivel|a level tool', 'El Clavo|a nail', 'El Tornillo|a screw', 'La Escuadra|a carpenter square'] },
    { theme: 'De cocina afilada', why: 'Cuchillo, tijeras, rallador y pelador.', cards: ['El Cuchillo|a kitchen knife', 'Las Tijeras|scissors', 'El Rallador|a grater', 'El Pelador|a peeler', 'El Sacacorchos|a corkscrew'] },
  ],
  instrumentos: [
    { theme: 'De cuerda', why: 'Guitarra, violín, arpa y contrabajo.', cards: ['La Guitarra|an acoustic guitar', 'El Violín|a violin', 'El Arpa|a harp', 'El Contrabajo|a double bass', 'El Banjo|a banjo'] },
    { theme: 'De viento', why: 'Trompeta, flauta, saxofón y clarinete.', cards: ['La Trompeta|a trumpet', 'La Flauta|a flute', 'El Saxofón|a saxophone', 'El Clarinete|a clarinet', 'La Trombón|a trombone'] },
    { theme: 'De teclas y fuelle', why: 'Piano, acordeón, órgano y armónica.', cards: ['El Piano|a grand piano', 'El Acordeón|an accordion', 'El Órgano|a pipe organ', 'La Armónica|a harmonica', 'El Teclado|a music keyboard'] },
    { theme: 'De percusión', why: 'Tambor, maracas, xilófono y pandereta.', cards: ['El Tambor|a drum', 'Las Maracas|maracas', 'El Xilófono|a xylophone', 'La Pandereta|a tambourine', 'Los Timbales|timbales'] },
  ],
  ropa: [
    { theme: 'De arriba', why: 'Camisa, playera, suéter y chaleco.', cards: ['La Camisa|a button shirt', 'La Playera|a t-shirt', 'El Suéter|a sweater', 'El Chaleco|a vest', 'La Blusa|a blouse'] },
    { theme: 'De abajo', why: 'Pantalón, falda, short y vestido.', cards: ['El Pantalón|trousers', 'La Falda|a skirt', 'El Short|shorts', 'El Vestido|a dress', 'El Overol|overalls'] },
    { theme: 'Abrigos', why: 'Chamarra, saco, gabardina y poncho.', cards: ['La Chamarra|a jacket', 'El Saco|a blazer', 'La Gabardina|a trench coat', 'El Poncho|a poncho', 'El Rebozo|a shawl'] },
    { theme: 'Calzado', why: 'Zapato, bota, tenis y sandalia.', cards: ['El Zapato|a leather shoe', 'La Bota|a boot', 'El Tenis|a sneaker', 'La Sandalia|a sandal', 'La Pantufla|a slipper'] },
    { theme: 'Para la cabeza', why: 'Sombrero, gorra, boina y bufanda.', cards: ['El Sombrero|a sombrero', 'La Gorra|a cap', 'La Boina|a beret', 'La Bufanda|a scarf', 'El Gorro|a beanie'] },
    { theme: 'Detalles', why: 'Corbata, cinturón, guante y calcetín.', cards: ['La Corbata|a necktie', 'El Cinturón|a belt', 'El Guante|a glove', 'El Calcetín|a sock', 'El Moño|a bow tie'] },
  ],
  accesorios: [
    { theme: 'Joyería', why: 'Anillo, collar, arete y pulsera.', cards: ['El Anillo|a ring', 'El Collar|a necklace', 'El Arete|an earring', 'La Pulsera|a bracelet', 'El Broche|a brooch'] },
    { theme: 'Se cargan', why: 'Bolsa, mochila, cartera y maleta.', cards: ['La Bolsa|a handbag', 'La Mochila|a backpack', 'La Cartera|a wallet', 'La Maleta|a suitcase', 'El Paraguas|an umbrella'] },
    { theme: 'En la cara', why: 'Lentes, reloj, abanico y mascada.', cards: ['Los Lentes|eyeglasses', 'El Reloj|a wristwatch', 'El Abanico|a folding fan', 'La Mascada|a headscarf', 'El Antifaz|a mask'] },
  ],
  vehiculos: [
    { theme: 'De ciudad', why: 'Coche, taxi, autobús y motocicleta.', cards: ['El Coche|a car', 'El Taxi|a taxi', 'El Autobús|a bus', 'La Motocicleta|a motorcycle', 'La Bicicleta|a bicycle'] },
    { theme: 'De trabajo', why: 'Camión, tractor, grúa y ambulancia.', cards: ['El Camión|a truck', 'El Tractor|a tractor', 'La Grúa|a crane truck', 'La Ambulancia|an ambulance', 'La Excavadora|an excavator'] },
    { theme: 'Del aire', why: 'Avión, helicóptero, globo y cohete.', cards: ['El Avión|an airplane', 'El Helicóptero|a helicopter', 'El Globo Aerostático|a hot air balloon', 'El Cohete|a rocket', 'El Planeador|a glider'] },
    { theme: 'Del agua', why: 'Barco, lancha, submarino y canoa.', cards: ['El Barco|a ship', 'La Lancha|a motorboat', 'El Submarino|a submarine', 'La Canoa|a canoe', 'El Velero|a sailboat'] },
    { theme: 'Sobre rieles', why: 'Tren, tranvía, vagón y locomotora.', cards: ['El Tren|a train', 'El Tranvía|a tram', 'El Vagón|a train car', 'La Locomotora|a locomotive', 'El Teleférico|a cable car'] },
  ],
  cuerpo: [
    { theme: 'La cara', why: 'Ojo, nariz, boca y oreja.', cards: ['El Ojo|a human eye', 'La Nariz|a human nose', 'La Boca|a human mouth', 'La Oreja|a human ear', 'La Ceja|an eyebrow'] },
    { theme: 'Extremidades', why: 'Mano, pie, brazo y pierna.', cards: ['La Mano|a human hand', 'El Pie|a human foot', 'El Brazo|a human arm', 'La Pierna|a human leg', 'El Codo|an elbow'] },
    { theme: 'Dedos y detalles', why: 'Dedo, uña, rodilla y hombro.', cards: ['El Dedo|a finger', 'La Uña|a fingernail', 'La Rodilla|a knee', 'El Hombro|a shoulder', 'El Talón|a heel'] },
    { theme: 'Cabeza', why: 'Diente, lengua, cabello y barba.', cards: ['El Diente|a tooth', 'La Lengua|a tongue', 'El Cabello|human hair', 'La Barba|a beard', 'El Bigote|a mustache'] },
    { theme: 'Por dentro', why: 'Corazón, cerebro, hueso y pulmón.', cards: ['El Corazón|an anatomical heart', 'El Cerebro|a human brain', 'El Hueso|a bone', 'El Pulmón|a lung', 'El Esqueleto|a skeleton'] },
  ],
  clima: [
    { theme: 'Del cielo', why: 'Nube, rayo, arcoíris y remolino.', cards: ['La Nube|a cloud', 'El Rayo|a lightning bolt', 'El Arcoíris|a rainbow', 'El Remolino|a whirlwind', 'El Tornado|a tornado'] },
    { theme: 'Cae del cielo', why: 'Lluvia, nieve, granizo y rocío.', cards: ['La Lluvia|falling rain', 'La Nieve|snow', 'El Granizo|hail', 'El Rocío|dew drops', 'La Escarcha|frost'] },
    { theme: 'Astros', why: 'Sol, luna, estrella y cometa.', cards: ['El Sol|the sun', 'La Luna|the moon', 'La Estrella|a star', 'El Cometa|a comet', 'El Planeta|a planet'] },
    { theme: 'Espacio', why: 'Satélite, galaxia, meteorito y saturno.', cards: ['El Satélite|a satellite', 'La Galaxia|a spiral galaxy', 'El Meteorito|a meteor', 'Saturno|the planet Saturn', 'El Astronauta|an astronaut'] },
  ],
  naturaleza: [
    { theme: 'Paisaje', why: 'Montaña, volcán, río y cascada.', cards: ['La Montaña|a mountain', 'El Volcán|a volcano', 'El Río|a river', 'La Cascada|a waterfall', 'El Cañón|a canyon'] },
    { theme: 'Agua y tierra', why: 'Lago, playa, isla y desierto.', cards: ['El Lago|a lake', 'La Playa|a beach', 'La Isla|an island', 'El Desierto|a desert', 'La Cueva|a cave'] },
    { theme: 'Del suelo', why: 'Roca, piedra, arena y cristal.', cards: ['La Roca|a boulder', 'La Piedra|a stone', 'La Arena|sand', 'El Cristal|a crystal', 'El Fósil|a fossil'] },
    { theme: 'Elementos', why: 'Fuego, agua, viento y hielo.', cards: ['El Fuego|a flame', 'El Agua|a water splash', 'El Viento|swirling wind', 'El Hielo|an ice cube', 'El Humo|a puff of smoke'] },
  ],
  plantas: [
    { theme: 'Flores', why: 'Rosa, girasol, tulipán y margarita.', cards: ['La Rosa|a rose', 'El Girasol|a sunflower', 'El Tulipán|a tulip', 'La Margarita|a daisy', 'La Orquídea|an orchid'] },
    { theme: 'De maceta', why: 'Cactus, nopal, helecho y bonsái.', cards: ['El Cactus|a cactus', 'El Nopal|a prickly pear cactus', 'El Helecho|a fern', 'El Bonsái|a bonsai tree', 'La Suculenta|a succulent'] },
    { theme: 'Partes de la planta', why: 'Hoja, semilla, raíz y capullo.', cards: ['La Hoja|a green leaf', 'La Semilla|a seed', 'La Raíz|a root', 'El Capullo|a flower bud', 'El Pétalo|a petal'] },
  ],
  arboles: [
    { theme: 'Árboles', why: 'Pino, palmera, roble y sauce.', cards: ['El Pino|a pine tree', 'La Palmera|a palm tree', 'El Roble|an oak tree', 'El Sauce|a willow tree', 'El Ciprés|a cypress tree'] },
    { theme: 'Dan fruto', why: 'Manzano, naranjo, olivo y bambú.', cards: ['El Manzano|an apple tree', 'El Naranjo|an orange tree', 'El Olivo|an olive tree', 'El Bambú|bamboo', 'El Tronco|a tree trunk'] },
  ],
  cocina: [
    { theme: 'Utensilios', why: 'Cuchara, tenedor, plato y taza.', cards: ['La Cuchara|a spoon', 'El Tenedor|a fork', 'El Plato|a plate', 'La Taza|a cup', 'El Vaso|a drinking glass'] },
    { theme: 'Para cocinar', why: 'Olla, sartén, cazo y comal.', cards: ['La Olla|a cooking pot', 'El Sartén|a frying pan', 'El Cazo|a saucepan', 'El Comal|a griddle', 'La Cacerola|a casserole dish'] },
    { theme: 'Electrodomésticos', why: 'Licuadora, tostador, batidora y horno.', cards: ['La Licuadora|a blender', 'El Tostador|a toaster', 'La Batidora|a mixer', 'El Horno|an oven', 'El Microondas|a microwave'] },
    { theme: 'Guardan', why: 'Botella, jarra, frasco y lata.', cards: ['La Botella|a bottle', 'La Jarra|a pitcher', 'El Frasco|a jar', 'La Lata|a tin can', 'El Termo|a thermos'] },
  ],
  comida: [
    { theme: 'Antojitos', why: 'Taco, tamal, quesadilla y tortilla.', cards: ['El Taco|a taco', 'El Tamal|a tamale', 'La Quesadilla|a quesadilla', 'La Tortilla|a tortilla', 'La Enchilada|an enchilada'] },
    { theme: 'Panadería', why: 'Pan, bolillo, concha y baguette.', cards: ['El Pan|a loaf of bread', 'El Bolillo|a bread roll', 'La Concha|a pan dulce', 'La Baguette|a baguette', 'El Croissant|a croissant'] },
    { theme: 'Del desayuno', why: 'Huevo, tocino, hotcake y cereal.', cards: ['El Huevo|a fried egg', 'El Tocino|bacon', 'El Hotcake|a pancake', 'El Cereal|a bowl of cereal', 'El Waffle|a waffle'] },
    { theme: 'Lácteos', why: 'Queso, mantequilla, yogur y crema.', cards: ['El Queso|a wedge of cheese', 'La Mantequilla|a stick of butter', 'El Yogur|a cup of yogurt', 'La Crema|sour cream', 'La Leche|a glass of milk'] },
    { theme: 'Rápida', why: 'Hamburguesa, pizza, hot dog y papas.', cards: ['La Hamburguesa|a hamburger', 'La Pizza|a pizza slice', 'El Hot Dog|a hot dog', 'Las Papas Fritas|french fries', 'El Sándwich|a sandwich'] },
  ],
  bebidas: [
    { theme: 'Calientes', why: 'Café, té, chocolate y atole.', cards: ['El Café|a cup of coffee', 'El Té|a cup of tea', 'El Chocolate Caliente|hot chocolate', 'El Atole|atole drink', 'El Ponche|fruit punch'] },
    { theme: 'Frías', why: 'Refresco, jugo, agua fresca y licuado.', cards: ['El Refresco|a soda bottle', 'El Jugo|a glass of juice', 'El Agua Fresca|agua fresca', 'El Licuado|a smoothie', 'La Limonada|lemonade'] },
  ],
  postres: [
    { theme: 'Dulces', why: 'Pastel, helado, dona y galleta.', cards: ['El Pastel|a slice of cake', 'El Helado|an ice cream cone', 'La Dona|a donut', 'La Galleta|a cookie', 'El Cupcake|a cupcake'] },
    { theme: 'Golosinas', why: 'Paleta, chicle, caramelo y flan.', cards: ['La Paleta|a lollipop', 'El Chicle|bubble gum', 'El Caramelo|a candy', 'El Flan|a flan', 'El Chocolate|a chocolate bar'] },
  ],
  muebles: [
    { theme: 'Para sentarse', why: 'Silla, sillón, banco y sofá.', cards: ['La Silla|a chair', 'El Sillón|an armchair', 'El Banco|a stool', 'El Sofá|a sofa', 'La Mecedora|a rocking chair'] },
    { theme: 'Superficies', why: 'Mesa, escritorio, repisa y buró.', cards: ['La Mesa|a table', 'El Escritorio|a desk', 'La Repisa|a shelf', 'El Buró|a nightstand', 'El Ropero|a wardrobe'] },
    { theme: 'Para dormir', why: 'Cama, cuna, litera y colchón.', cards: ['La Cama|a bed', 'La Cuna|a crib', 'La Litera|a bunk bed', 'El Colchón|a mattress', 'La Almohada|a pillow'] },
  ],
  hogar: [
    { theme: 'Dan luz', why: 'Lámpara, vela, foco y linterna.', cards: ['La Lámpara|a lamp', 'La Vela|a candle', 'El Foco|a light bulb', 'La Linterna|a flashlight', 'El Farol|a lantern'] },
    { theme: 'En la pared', why: 'Reloj, cuadro, espejo y ventana.', cards: ['El Reloj de Pared|a wall clock', 'El Cuadro|a framed picture', 'El Espejo|a mirror', 'La Ventana|a window', 'La Puerta|a door'] },
    { theme: 'De limpieza', why: 'Escoba, trapeador, cubeta y jabón.', cards: ['La Escoba|a broom', 'El Trapeador|a mop', 'La Cubeta|a bucket', 'El Jabón|a bar of soap', 'La Aspiradora|a vacuum cleaner'] },
    { theme: 'Llaves y candados', why: 'Llave, candado, cerradura y cadena.', cards: ['La Llave|a key', 'El Candado|a padlock', 'La Cerradura|a door lock', 'La Cadena|a chain', 'El Cerrojo|a bolt latch'] },
  ],
  bano: [
    { theme: 'Del baño', why: 'Cepillo, peine, toalla y regadera.', cards: ['El Cepillo|a toothbrush', 'El Peine|a comb', 'La Toalla|a towel', 'La Regadera de Baño|a shower head', 'La Tina|a bathtub'] },
    { theme: 'Aseo', why: 'Tijeras, rastrillo, perfume y esponja.', cards: ['Las Tijeras de Uñas|nail clippers', 'El Rastrillo de Afeitar|a razor', 'El Perfume|a perfume bottle', 'La Esponja|a sponge', 'El Espejo de Mano|a hand mirror'] },
  ],
  oficios: [
    { theme: 'Oficios de la ciudad', why: 'Doctor, policía, bombero y cartero.', cards: ['El Doctor|a doctor', 'El Policía|a police officer', 'El Bombero|a firefighter', 'El Cartero|a mail carrier', 'La Enfermera|a nurse'] },
    { theme: 'Con las manos', why: 'Carpintero, herrero, albañil y sastre.', cards: ['El Carpintero|a carpenter', 'El Herrero|a blacksmith', 'El Albañil|a bricklayer', 'El Sastre|a tailor', 'El Zapatero|a shoemaker'] },
    { theme: 'Del campo y mar', why: 'Campesino, pescador, vaquero y jardinero.', cards: ['El Campesino|a farmer', 'El Pescador|a fisherman', 'El Vaquero|a cowboy', 'El Jardinero|a gardener', 'El Pastor|a shepherd'] },
    { theme: 'De arte y ciencia', why: 'Pintor, músico, chef y científico.', cards: ['El Pintor|a painter artist', 'El Músico|a musician', 'El Chef|a chef', 'El Científico|a scientist', 'El Payaso|a clown'] },
    { theme: 'Uniformados', why: 'Piloto, marinero, soldado y juez.', cards: ['El Piloto|an airline pilot', 'El Marinero|a sailor', 'El Soldado|a soldier', 'El Juez|a judge', 'El Capitán|a ship captain'] },
  ],
  deportes: [
    { theme: 'De pelota', why: 'Fútbol, básquetbol, tenis y béisbol.', cards: ['El Balón de Fútbol|a soccer ball', 'El Balón de Básquetbol|a basketball', 'La Pelota de Tenis|a tennis ball', 'La Pelota de Béisbol|a baseball', 'El Balón de Fútbol Americano|a football'] },
    { theme: 'Equipo', why: 'Raqueta, bate, guante y casco.', cards: ['La Raqueta|a tennis racket', 'El Bate|a baseball bat', 'El Guante de Béisbol|a baseball glove', 'El Casco|a sports helmet', 'La Portería|a goal net'] },
    { theme: 'En movimiento', why: 'Patineta, patines, esquí y tabla.', cards: ['La Patineta|a skateboard', 'Los Patines|roller skates', 'El Esquí|skis', 'La Tabla de Surf|a surfboard', 'El Trineo|a sled'] },
    { theme: 'Premios', why: 'Trofeo, medalla, copa y listón.', cards: ['El Trofeo|a trophy', 'La Medalla|a medal', 'La Copa|a championship cup', 'El Listón|a prize ribbon', 'La Bandera de Meta|a checkered flag'] },
  ],
  juguetes: [
    { theme: 'Clásicos', why: 'Pelota, muñeca, oso y trompo.', cards: ['La Muñeca|a doll', 'El Osito|a teddy bear', 'El Trompo|a spinning top', 'La Canica|a marble', 'El Yoyo|a yo-yo'] },
    { theme: 'De armar y rodar', why: 'Bloques, cometa, carrito y globo.', cards: ['Los Bloques|building blocks', 'El Papalote|a kite', 'El Carrito|a toy car', 'El Globo|a party balloon', 'El Rompecabezas|a puzzle'] },
    { theme: 'Juguetes de feria', why: 'Dado, naipe, tambora y silbato.', cards: ['El Dado|a dice', 'El Naipe|a playing card', 'El Silbato|a whistle', 'La Matraca|a rattle', 'El Balero|a cup and ball toy'] },
  ],
  escuela: [
    { theme: 'Para escribir', why: 'Lápiz, pluma, crayón y goma.', cards: ['El Lápiz|a pencil', 'La Pluma|a pen', 'El Crayón|a crayon', 'La Goma|an eraser', 'El Marcador|a marker'] },
    { theme: 'En el pupitre', why: 'Libro, cuaderno, regla y tijeras.', cards: ['El Libro|a book', 'El Cuaderno|a notebook', 'La Regla|a ruler', 'Las Tijeras Escolares|scissors', 'El Sacapuntas|a pencil sharpener'] },
    { theme: 'En el salón', why: 'Pizarrón, globo terráqueo, mapa y mochila.', cards: ['El Pizarrón|a chalkboard', 'El Globo Terráqueo|a globe', 'El Mapa|a map', 'La Mochila Escolar|a school backpack', 'La Campana Escolar|a school bell'] },
  ],
  tecnologia: [
    { theme: 'Pantallas', why: 'Celular, computadora, tableta y tele.', cards: ['El Celular|a smartphone', 'La Computadora|a laptop', 'La Tableta|a tablet', 'La Televisión|a television', 'El Monitor|a computer monitor'] },
    { theme: 'Aparatos', why: 'Cámara, audífonos, bocina y control.', cards: ['La Cámara|a camera', 'Los Audífonos|headphones', 'La Bocina|a speaker', 'El Control Remoto|a remote control', 'El Micrófono|a microphone'] },
    { theme: 'Conectar', why: 'Enchufe, pila, foco LED y cable.', cards: ['El Enchufe|a power plug', 'La Pila|a battery', 'El Cargador|a charger', 'El Cable|a cable', 'El Robot|a robot'] },
  ],
  oficina: [
    { theme: 'Papeleo', why: 'Grapadora, clip, sobre y carpeta.', cards: ['La Engrapadora|a stapler', 'El Clip|a paper clip', 'El Sobre|an envelope', 'La Carpeta|a folder', 'El Calendario|a calendar'] },
    { theme: 'De escritorio', why: 'Teléfono, sello, calculadora y lupa.', cards: ['El Teléfono|a desk phone', 'El Sello|a rubber stamp', 'La Calculadora|a calculator', 'La Lupa|a magnifying glass', 'El Portarretratos|a photo frame'] },
  ],
  simbolos: [
    { theme: 'Formas', why: 'Círculo, cuadrado, triángulo y estrella.', cards: ['El Círculo|a circle shape', 'El Cuadrado|a square shape', 'El Triángulo|a triangle shape', 'La Estrella|a star shape', 'El Rombo|a diamond shape'] },
    { theme: 'Signos', why: 'Corazón, flecha, cruz y llave musical.', cards: ['El Corazón|a heart symbol', 'La Flecha|an arrow', 'La Cruz|a cross', 'La Llave Musical|a musical clef', 'El Signo de Interrogación|a question mark'] },
  ],
  edificios: [
    { theme: 'Edificios de la ciudad', why: 'Casa, iglesia, castillo y rascacielos.', cards: ['La Casa|a house', 'La Iglesia|a church', 'El Castillo|a castle', 'El Rascacielos|a skyscraper', 'El Faro|a lighthouse'] },
    { theme: 'Lugares', why: 'Escuela, hospital, tienda y granero.', cards: ['La Escuela|a school building', 'El Hospital|a hospital', 'La Tienda|a shop', 'El Granero|a barn', 'El Molino|a windmill'] },
    { theme: 'Estructuras', why: 'Puente, torre, pirámide y carpa.', cards: ['El Puente|a bridge', 'La Torre|a tower', 'La Pirámide|a pyramid', 'La Carpa|a tent', 'La Fuente|a fountain'] },
  ],
  tesoro: [
    { theme: 'Riqueza', why: 'Corona, moneda, diamante y cofre.', cards: ['La Corona|a golden crown', 'La Moneda|a gold coin', 'El Diamante|a diamond', 'El Cofre|a treasure chest', 'El Lingote|a gold bar'] },
    { theme: 'Piedras', why: 'Rubí, esmeralda, perla y anillo.', cards: ['El Rubí|a ruby', 'La Esmeralda|an emerald', 'La Perla|a pearl', 'El Zafiro|a sapphire', 'La Gema|a gemstone'] },
  ],
  fiesta: [
    { theme: 'Celebración', why: 'Piñata, pastel, regalo y confeti.', cards: ['La Piñata|a piñata', 'El Pastel de Fiesta|a birthday cake', 'El Regalo|a gift box', 'El Confeti|confetti', 'La Serpentina|a paper streamer'] },
    { theme: 'Luces y ruido', why: 'Cohete, vela, campana y máscara.', cards: ['El Cohete de Fiesta|a firework', 'La Velita|a birthday candle', 'La Campana|a bell', 'La Máscara|a festival mask', 'El Farolito|a paper lantern'] },
    { theme: 'Día de muertos', why: 'Calavera, catrina, cempasúchil y veladora.', cards: ['La Calavera|a sugar skull', 'La Catrina|a Catrina figure', 'El Cempasúchil|a marigold flower', 'La Veladora|a votive candle', 'El Papel Picado|papel picado'] },
  ],
  mito: [
    { theme: 'Criaturas', why: 'Dragón, unicornio, sirena y fénix.', cards: ['El Dragón|a dragon', 'El Unicornio|a unicorn', 'La Sirena|a mermaid', 'El Fénix|a phoenix', 'El Grifo|a griffin'] },
    { theme: 'Fantasmales', why: 'Fantasma, bruja, vampiro y momia.', cards: ['El Fantasma|a ghost', 'La Bruja|a witch', 'El Vampiro|a vampire', 'La Momia|a mummy', 'El Esqueleto de Fiesta|a skeleton'] },
    { theme: 'Del cielo y mar', why: 'Ángel, hada, duende y kraken.', cards: ['El Ángel|an angel', 'El Hada|a fairy', 'El Duende|an elf', 'El Ogro|an ogre', 'El Diablito|a little devil'] },
  ],
  historico: [
    { theme: 'De combate', why: 'Espada, escudo, arco y lanza.', cards: ['La Espada|a sword', 'El Escudo|a shield', 'El Arco|a bow', 'La Lanza|a spear', 'El Casco de Guerra|a war helmet'] },
    { theme: 'Del pasado', why: 'Ancla, brújula, catalejo y timón.', cards: ['El Ancla|an anchor', 'La Brújula|a compass', 'El Catalejo|a spyglass', 'El Timón|a ship wheel', 'El Mapa del Tesoro|a treasure map'] },
    { theme: 'Antiguos', why: 'Antorcha, pergamino, ánfora y reloj de arena.', cards: ['La Antorcha|a torch', 'El Pergamino|a scroll', 'El Ánfora|an amphora', 'El Reloj de Arena|an hourglass', 'La Vasija|a clay pot'] },
  ],
};

const EXTRA = {
  frutas2: [
    { theme: 'Bayas', why: 'Arándano, grosella, zarzamora y capulín.', cards: ['El Arándano|a blueberry', 'La Grosella|a currant berry', 'La Zarzamora|a blackberry', 'El Capulín|a wild cherry', 'La Uva Pasa|a raisin'] },
    { theme: 'Exóticas', why: 'Lichi, carambola, guanábana y tamarindo.', cards: ['El Lichi|a lychee', 'La Carambola|a starfruit', 'La Guanábana|a soursop', 'El Tamarindo|a tamarind', 'La Pitaya|a dragon fruit'] },
    { theme: 'De la milpa', why: 'Tuna, nanche, jícama y caña.', cards: ['La Tuna|a prickly pear fruit', 'El Nanche|a nance fruit', 'La Jícama|a jicama', 'La Caña|a sugar cane', 'El Zapote|a sapote fruit'] },
  ],
  verduras2: [
    { theme: 'De tallo y flor', why: 'Apio, coliflor, alcachofa y espárrago.', cards: ['El Apio|celery', 'La Coliflor|cauliflower', 'La Alcachofa|an artichoke', 'El Espárrago|asparagus', 'El Poro|a leek'] },
    { theme: 'De sopa', why: 'Calabacita, nabo, quelite y hongos.', cards: ['La Calabacita|a zucchini', 'El Nabo|a turnip', 'El Quelite|leafy greens', 'El Hongo|a mushroom', 'La Col|a cabbage'] },
    { theme: 'Chiles', why: 'Jalapeño, habanero, poblano y serrano.', cards: ['El Jalapeño|a jalapeño', 'El Habanero|a habanero pepper', 'El Poblano|a poblano pepper', 'El Serrano|a serrano pepper', 'El Chipotle|a dried chipotle'] },
  ],
  granos: [
    { theme: 'Cereales', why: 'Arroz, trigo, avena y cebada.', cards: ['El Arroz|a bowl of rice', 'El Trigo|wheat stalks', 'La Avena|oats', 'La Cebada|barley', 'El Maíz|dried corn'] },
    { theme: 'Nueces', why: 'Nuez, almendra, cacahuate y pistache.', cards: ['La Nuez|a walnut', 'La Almendra|an almond', 'El Cacahuate|a peanut', 'El Pistache|a pistachio', 'La Avellana|a hazelnut'] },
    { theme: 'Especias', why: 'Canela, vainilla, clavo y comino.', cards: ['La Canela|a cinnamon stick', 'La Vainilla|a vanilla pod', 'El Clavo de Olor|clove spice', 'El Comino|cumin', 'El Laurel|a bay leaf'] },
  ],
  dinos: [
    { theme: 'Dinosaurios', why: 'T-Rex, triceratops, estegosaurio y pterodáctilo.', cards: ['El Tiranosaurio|a T-Rex', 'El Triceratops|a triceratops', 'El Estegosaurio|a stegosaurus', 'El Pterodáctilo|a pterodactyl', 'El Braquiosaurio|a brachiosaurus'] },
    { theme: 'Prehistóricos', why: 'Mamut, dientes de sable, dodo y trilobite.', cards: ['El Mamut|a woolly mammoth', 'El Tigre Dientes de Sable|a saber-tooth tiger', 'El Dodo|a dodo bird', 'El Trilobite|a trilobite', 'El Velociraptor|a velociraptor'] },
  ],
  aves2: [
    { theme: 'De caza y monte', why: 'Faisán, codorniz, perdiz y pavorreal.', cards: ['El Faisán|a pheasant', 'La Codorniz|a quail', 'La Perdiz|a partridge', 'El Correcaminos|a roadrunner', 'El Pato|a duck'] },
    { theme: 'Del árbol', why: 'Pájaro carpintero, ruiseñor, canario y jilguero.', cards: ['El Pájaro Carpintero|a woodpecker', 'El Ruiseñor|a nightingale', 'El Canario|a canary', 'El Jilguero|a goldfinch', 'El Martín Pescador|a kingfisher'] },
  ],
  insectos2: [
    { theme: 'Insectos del jardín', why: 'Mariquita, mantis, tijerilla y pulgón.', cards: ['La Mariquita|a ladybug', 'La Mantis|a praying mantis', 'La Tijerilla|an earwig', 'El Pulgón|an aphid', 'El Escarabajo Rinoceronte|a rhinoceros beetle'] },
    { theme: 'Molestos', why: 'Pulga, piojo, termita y tábano.', cards: ['La Pulga|a flea', 'El Piojo|a louse', 'La Termita|a termite', 'El Tábano|a horsefly', 'El Zancudo|a mosquito'] },
  ],
  mar2: [
    { theme: 'Peces de río', why: 'Trucha, bagre, carpa y piraña.', cards: ['La Trucha|a trout', 'El Bagre|a catfish', 'La Piraña|a piranha', 'La Anguila|an eel'] },
    { theme: 'Del arrecife', why: 'Coral, alga, erizo y anémona.', cards: ['El Coral|a coral', 'El Alga|seaweed', 'El Erizo de Mar|a sea urchin', 'La Anémona|a sea anemone', 'El Pez Payaso|a clownfish'] },
  ],
  cuerpo2: [
    { theme: 'Órganos', why: 'Estómago, hígado, riñón y pulmones.', cards: ['El Estómago|a stomach', 'El Hígado|a liver', 'El Riñón|a kidney', 'Los Pulmones|lungs', 'El Intestino|intestines'] },
    { theme: 'Estructura', why: 'Columna, costilla, cráneo y músculo.', cards: ['La Columna|a spine', 'La Costilla|a rib', 'El Cráneo|a skull', 'El Músculo|a flexed muscle', 'La Vena|a vein'] },
    { theme: 'La cara de cerca', why: 'Mejilla, labio, mentón y pestaña.', cards: ['La Mejilla|a cheek', 'El Labio|lips', 'El Mentón|a chin', 'La Pestaña|an eyelash', 'La Frente|a forehead'] },
  ],
  herramientas2: [
    { theme: 'De taller', why: 'Soplete, lija, prensa y gato.', cards: ['El Soplete|a blowtorch', 'La Lija|sandpaper', 'La Prensa|a clamp', 'El Gato Hidráulico|a car jack', 'El Yunque|an anvil'] },
    { theme: 'De pintar', why: 'Brocha, rodillo, cubeta y espátula.', cards: ['La Brocha|a paintbrush', 'El Rodillo|a paint roller', 'La Cubeta de Pintura|a paint bucket', 'La Espátula|a putty knife', 'La Cinta de Pintor|painter tape'] },
    { theme: 'De construcción', why: 'Ladrillo, tabla, tubo y alambre.', cards: ['El Ladrillo|a brick', 'La Tabla|a wooden plank', 'El Tubo|a pipe', 'El Alambre|coiled wire', 'La Viga|a steel beam'] },
  ],
  cocina2: [
    { theme: 'Gadgets', why: 'Colador, embudo, batidor y cucharón.', cards: ['El Colador|a strainer', 'El Embudo|a funnel', 'El Batidor|a whisk', 'El Cucharón|a ladle', 'El Molcajete|a molcajete'] },
    { theme: 'Cortar y medir', why: 'Tabla de picar, exprimidor, balanza y molde.', cards: ['La Tabla de Picar|a cutting board', 'El Exprimidor|a juicer', 'La Balanza|a kitchen scale', 'El Molde|a baking mold', 'El Rodillo de Cocina|a rolling pin'] },
  ],
  mesa: [
    { theme: 'Poner la mesa', why: 'Mantel, servilleta, salero y candelabro.', cards: ['El Mantel|a tablecloth', 'La Servilleta|a napkin', 'El Salero|a salt shaker', 'El Candelabro|a candelabra', 'La Azucarera|a sugar bowl'] },
  ],
  comida2: [
    { theme: 'Del mundo', why: 'Sushi, ramen, paella y curry.', cards: ['El Sushi|sushi rolls', 'El Ramen|a bowl of ramen', 'La Paella|a paella', 'El Curry|a curry dish', 'El Pretzel|a pretzel'] },
    { theme: 'Carnes', why: 'Pollo asado, filete, salchicha y jamón.', cards: ['El Pollo Asado|a roast chicken', 'El Filete|a steak', 'La Salchicha|a sausage', 'El Jamón|sliced ham', 'La Costilla BBQ|barbecue ribs'] },
    { theme: 'De sopa y guiso', why: 'Sopa, caldo, arroz y frijoles.', cards: ['La Sopa|a bowl of soup', 'El Caldo|a broth', 'El Arroz Cocido|cooked rice', 'Los Frijoles|refried beans', 'El Guisado|a stew'] },
  ],
  dulces2: [
    { theme: 'Dulces de feria', why: 'Algodón de azúcar, malvavisco, gomita y bombón.', cards: ['El Algodón de Azúcar|cotton candy', 'El Malvavisco|a marshmallow', 'La Gomita|a gummy candy', 'El Bombón|a bonbon', 'La Manzana Acaramelada|a candy apple'] },
    { theme: 'Tradicionales', why: 'Cajeta, alegría, palanqueta y mazapán.', cards: ['La Cajeta|caramel spread', 'La Alegría|an amaranth bar', 'La Palanqueta|a peanut brittle', 'El Mazapán|a marzipan candy', 'El Tamarindo Dulce|a tamarind candy'] },
  ],
  bebidas2: [
    { theme: 'Para brindar', why: 'Cerveza, vino, tequila y champaña.', cards: ['La Cerveza|a beer mug', 'El Vino|a glass of wine', 'El Tequila|a tequila shot', 'La Champaña|a champagne glass', 'El Coctel|a cocktail'] },
  ],
  transporte2: [
    { theme: 'De emergencia', why: 'Patrulla, bomberos, ambulancia y barredora.', cards: ['La Patrulla|a police car', 'El Camión de Bomberos|a fire truck', 'La Camioneta|a pickup truck', 'La Barredora|a street sweeper', 'La Volqueta|a dump truck'] },
    { theme: 'De la feria', why: 'Montaña rusa, carrusel, rueda de la fortuna y carrito chocón.', cards: ['La Montaña Rusa|a roller coaster', 'El Carrusel|a carousel', 'La Rueda de la Fortuna|a ferris wheel', 'El Carrito Chocón|a bumper car', 'El Cuatrimoto|an ATV'] },
    { theme: 'Sobre nieve y arena', why: 'Trineo, moto de nieve, camello y globo.', cards: ['El Trineo de Nieve|a snowmobile', 'El Carruaje|a horse carriage', 'El Monopatín|a scooter', 'El Triciclo|a tricycle', 'La Patineta Eléctrica|an e-scooter'] },
  ],
  espacio2: [
    { theme: 'Explorar', why: 'Transbordador, telescopio, estación y ovni.', cards: ['El Transbordador|a space shuttle', 'El Telescopio|a telescope', 'La Estación Espacial|a space station', 'El Ovni|a UFO', 'El Rover|a mars rover'] },
  ],
  clima2: [
    { theme: 'Extremos', why: 'Huracán, ventisca, aurora y neblina.', cards: ['El Huracán|a hurricane', 'La Ventisca|a blizzard', 'La Aurora|the northern lights', 'La Neblina|thick fog', 'El Relámpago|a lightning flash'] },
  ],
  naturaleza2: [
    { theme: 'Verde y frondoso', why: 'Bosque, selva, pradera y pantano.', cards: ['El Bosque|a forest', 'La Selva|a jungle', 'La Pradera|a meadow', 'El Pantano|a swamp', 'El Oasis|an oasis'] },
    { theme: 'De hielo y fuego', why: 'Glaciar, géiser, duna y catarata.', cards: ['El Glaciar|a glacier', 'El Géiser|a geyser', 'La Duna|a sand dune', 'La Catarata|a large waterfall', 'El Iceberg|an iceberg'] },
  ],
  flores2: [
    { theme: 'Del ramo', why: 'Lirio, clavel, amapola y jazmín.', cards: ['El Lirio|a lily', 'El Clavel|a carnation', 'La Amapola|a poppy', 'El Jazmín|jasmine', 'La Dalia|a dahlia'] },
    { theme: 'De temporada', why: 'Lavanda, nochebuena, azucena y violeta.', cards: ['La Lavanda|lavender', 'La Nochebuena|a poinsettia', 'La Azucena|a white lily', 'La Violeta|a violet', 'El Loto|a lotus flower'] },
  ],
  arboles2: [
    { theme: 'Del norte', why: 'Abeto, arce, secuoya y baobab.', cards: ['El Abeto|a fir tree', 'El Arce|a maple tree', 'La Secuoya|a redwood', 'El Baobab|a baobab tree', 'El Cerezo|a cherry blossom tree'] },
  ],
  medico: [
    { theme: 'Del doctor', why: 'Jeringa, estetoscopio, termómetro y curita.', cards: ['La Jeringa|a syringe', 'El Estetoscopio|a stethoscope', 'El Termómetro|a thermometer', 'La Curita|a bandage', 'La Venda|a gauze wrap'] },
    { theme: 'Para sanar', why: 'Muleta, silla de ruedas, pastilla y yeso.', cards: ['La Muleta|a crutch', 'La Silla de Ruedas|a wheelchair', 'La Pastilla|a pill', 'El Yeso|an arm cast', 'El Botiquín|a first aid kit'] },
  ],
  bano2: [
    { theme: 'En el lavabo', why: 'Inodoro, lavabo, báscula y pasta.', cards: ['El Inodoro|a toilet', 'El Lavabo|a sink', 'La Báscula|a bathroom scale', 'La Pasta de Dientes|a toothpaste tube', 'La Secadora de Pelo|a hair dryer'] },
  ],
  oficina2: [
    { theme: 'De la oficina', why: 'Proyector, perforadora, cinta y clip.', cards: ['El Proyector|a projector', 'La Perforadora|a hole punch', 'La Cinta Adhesiva|a tape dispenser', 'El Pisapapeles|a paperweight', 'El Archivero|a file cabinet'] },
  ],
  escuela2: [
    { theme: 'Geometría', why: 'Compás, transportador, escuadra y calculadora.', cards: ['El Compás|a drawing compass', 'El Transportador|a protractor', 'La Escuadra Escolar|a set square', 'El Ábaco|an abacus', 'El Gis|a piece of chalk'] },
    { theme: 'Para el recreo', why: 'Lonchera, diccionario, mochila y termo.', cards: ['La Lonchera|a lunchbox', 'El Diccionario|a dictionary', 'El Termo Escolar|a thermos', 'El Estuche|a pencil case', 'La Libreta|a small notebook'] },
  ],
  musica2: [
    { theme: 'Más cuerdas', why: 'Ukulele, mandolina, sitar y laúd.', cards: ['El Ukulele|a ukulele', 'La Mandolina|a mandolin', 'El Sitar|a sitar', 'El Laúd|a lute', 'El Charango|a charango'] },
    { theme: 'Batería', why: 'Batería, platillos, bongó y güiro.', cards: ['La Batería|a drum kit', 'Los Platillos|cymbals', 'El Bongó|bongo drums', 'El Güiro|a güiro', 'La Conga|a conga drum'] },
  ],
  deportes2: [
    { theme: 'Gimnasio', why: 'Pesas, cuerda, mancuerna y colchoneta.', cards: ['Las Pesas|a barbell', 'La Cuerda para Saltar|a jump rope', 'La Mancuerna|a dumbbell', 'La Colchoneta|a yoga mat', 'La Kettlebell|a kettlebell'] },
    { theme: 'De puntería', why: 'Dardos, boliche, arco y guante de box.', cards: ['Los Dardos|a dartboard', 'El Bolo|a bowling pin', 'El Arco y Flecha|a bow and arrow', 'El Guante de Box|a boxing glove', 'El Palo de Golf|a golf club'] },
  ],
  oficios2: [
    { theme: 'De servicio', why: 'Mesero, barbero, cartero y bombero.', cards: ['El Mesero|a waiter', 'El Barbero|a barber', 'El Cocinero|a cook', 'El Panadero|a baker', 'El Carnicero|a butcher'] },
    { theme: 'Que cuidan', why: 'Veterinario, dentista, maestro y bibliotecario.', cards: ['El Veterinario|a veterinarian', 'El Dentista|a dentist', 'El Maestro|a teacher', 'El Bibliotecario|a librarian', 'El Astronauta|an astronaut'] },
    { theme: 'Del espectáculo', why: 'Mago, bailarina, malabarista y torero.', cards: ['El Mago|a magician', 'La Bailarina|a ballerina', 'El Malabarista|a juggler', 'El Torero|a bullfighter', 'El Domador|a lion tamer'] },
  ],
  bebe: [
    { theme: 'Del bebé', why: 'Biberón, chupón, sonaja y carriola.', cards: ['El Biberón|a baby bottle', 'El Chupón|a pacifier', 'La Sonaja|a baby rattle', 'La Carriola|a stroller', 'El Babero|a bib'] },
  ],
  compras: [
    { theme: 'De la tienda', why: 'Billete, tarjeta, carrito y caja.', cards: ['El Billete|a banknote', 'La Tarjeta|a credit card', 'El Carrito de Compras|a shopping cart', 'La Caja Registradora|a cash register', 'La Etiqueta|a price tag'] },
  ],
  senales: [
    { theme: 'De la calle', why: 'Semáforo, alto, cono e hidrante.', cards: ['El Semáforo|a traffic light', 'El Alto|a stop sign', 'El Cono|a traffic cone', 'El Hidrante|a fire hydrant', 'El Poste|a street lamp post'] },
  ],
  playa: [
    { theme: 'En la arena', why: 'Sombrilla, salvavidas, palapa y pelota.', cards: ['La Sombrilla|a beach umbrella', 'El Salvavidas|a life ring', 'La Palapa|a palapa hut', 'La Pelota de Playa|a beach ball', 'El Castillo de Arena|a sandcastle'] },
    { theme: 'De camping', why: 'Fogata, saco de dormir, hamaca y hacha.', cards: ['La Fogata|a campfire', 'El Saco de Dormir|a sleeping bag', 'La Hamaca|a hammock', 'El Hacha de Campo|a camping axe', 'La Cantimplora|a canteen'] },
  ],
  arte: [
    { theme: 'Del pintor', why: 'Pincel, paleta, caballete y lienzo.', cards: ['El Pincel|an artist brush', 'La Paleta de Colores|a paint palette', 'El Caballete|an easel', 'El Lienzo|a canvas', 'La Acuarela|a watercolor set'] },
  ],
  tiempo: [
    { theme: 'Marcan la hora', why: 'Despertador, cronómetro, calendario y reloj de arena.', cards: ['El Despertador|an alarm clock', 'El Cronómetro|a stopwatch', 'El Reloj de Bolsillo|a pocket watch', 'El Reloj de Sol|a sundial', 'La Alarma|a ringing alarm'] },
  ],
};
Object.assign(POOLS, EXTRA);

// ── build ───────────────────────────────────────────────────────────────
const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
function slug(name) {
  return strip(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
function shuffle(a, seed) {
  a = [...a];
  // deterministic LCG so runs are reproducible
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const cards = new Map(); // id -> {id,name,number,family,en}
const groups = {};
let num = 55;
let seed = 7;

for (const [family, subs] of Object.entries(POOLS)) {
  for (const sub of subs) {
    const ids = [];
    for (const entry of sub.cards) {
      const [name, en] = entry.split('|');
      const id = slug(name);
      if (!cards.has(id)) {
        cards.set(id, { id, name, number: num++, family, en: en.trim() });
      }
      ids.push(id);
    }
    // Emit overlapping 4-card groups from this ≤7 pool via sliding windows so
    // EVERY card is covered by ≥1 group. Two groups from the same pool always
    // share ≥1 card (pool ≤7) so they can never co-occur in a round.
    const order = shuffle(ids, (seed += 101));
    const wins = [];
    for (let start = 0; start + 4 <= order.length; start += 2) wins.push(order.slice(start, start + 4));
    const lastCovered = wins.length ? (wins.length - 1) * 2 + 3 : -1;
    if (lastCovered < order.length - 1) wins.push(order.slice(order.length - 4));
    const usedKeys = new Set();
    let gi = 0;
    for (const w of wins) {
      const four = [...w].sort();
      const key = four.join(',');
      if (usedKeys.has(key)) continue;
      usedKeys.add(key);
      gi++;
      groups[`${family}_${slug(sub.theme)}_${gi}`] = { kind: 'cat', cards: four, theme: sub.theme, why: sub.why };
    }
  }
}

// ── outputs ───────────────────────────────────────────────────────────────
const cardList = [...cards.values()].map(({ id, name, number, family }) => ({ id, name, number, family, emoji: '🃏' }));
const prompts = {};
for (const c of cards.values()) prompts[c.id] = `${c.en}, ${STYLE}`;

// ── validation ──────────────────────────────────────────────────────────
const ids = [...cards.keys()];
const dupCheck = new Set(ids);
let issues = 0;
// every group has 4 distinct known cards
for (const [ref, g] of Object.entries(groups)) {
  if (g.cards.length !== 4 || new Set(g.cards).size !== 4) { console.log('BAD GROUP size', ref); issues++; }
  for (const c of g.cards) if (!dupCheck.has(c)) { console.log('UNKNOWN card', ref, c); issues++; }
}
// card membership stats
const mem = {};
for (const g of Object.values(groups)) for (const c of g.cards) mem[c] = (mem[c] ?? 0) + 1;
const memValues = ids.map((i) => mem[i] ?? 0);
const orphan = ids.filter((i) => (mem[i] ?? 0) === 0);

import fs from 'fs';
fs.writeFileSync('/home/claude/coplas-expansion-cards.json', JSON.stringify(cardList, null, 2));
fs.writeFileSync('/home/claude/coplas-expansion-groups.json', JSON.stringify(groups, null, 2));
fs.writeFileSync('/home/claude/coplas-expansion-prompts.json', JSON.stringify(prompts, null, 2));

console.log('Families:        ', Object.keys(POOLS).length);
console.log('Sub-themes:      ', Object.values(POOLS).reduce((n, s) => n + s.length, 0));
console.log('Unique cards:    ', cards.size, '(base 54 + expansion =', 54 + cards.size, 'total)');
console.log('Groups (cat):    ', Object.keys(groups).length);
console.log('Card membership: ', 'min', Math.min(...memValues), 'max', Math.max(...memValues), 'avg', (memValues.reduce((a, b) => a + b, 0) / memValues.length).toFixed(2));
console.log('Orphan cards:    ', orphan.length, orphan.slice(0, 8));
const byTheme = {};
for (const g of Object.values(groups)) (byTheme[g.theme] ??= []).push(g.cards);
let riskyThemes = 0;
for (const list of Object.values(byTheme)) {
  let disjoint = false;
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const s = new Set(list[i]);
      if (!list[j].some((c) => s.has(c))) disjoint = true;
    }
  if (disjoint) riskyThemes++;
}
console.log('Theme labels:    ', Object.keys(byTheme).length, 'distinct;', riskyThemes, 'with 2+ card-disjoint groups (co-occurrence risk — must be 0)');
console.log('Validation issues:', issues);
