const https = require('https');
const http = require('http');

function httpRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const fullOptions = {
      ...options,
      headers: options.headers || {}
    };
    const req = client.request(url, fullOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const result = {
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          data: data,
          json: () => {
            try {
              return JSON.parse(data);
            } catch (e) {
              return { error: data };
            }
          }
        };
        resolve(result);
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

const materialUrls = [
  'https://www.pooltile.com.au/product/cmc562-ubud-green-wavy-48mm/',
  'https://www.pooltile.com.au/product/cmc655-druid-grey-kit-kat-20mm/',
  'https://www.pooltile.com.au/product/silver-shadow-limestonio-coping/',
  'https://www.pooltile.com.au/product/silver-shadow-limestonio-20mm/',
  'https://www.pooltile.com.au/product/mercury-coping/',
  'https://www.pooltile.com.au/product/mercury/',
  'https://www.pooltile.com.au/product/cmc395-sagebrush-48mm/',
  'https://www.pooltile.com.au/product/cmc392-ashline-95mm/',
  'https://www.pooltile.com.au/product/cmc410-shoreline-95mm/',
  'https://www.pooltile.com.au/product/cmc413-saltwind-95mm/',
  'https://www.pooltile.com.au/product/cmc396-sagebrush-95mm/',
  'https://www.pooltile.com.au/product/cmc406-autumn-grey-95mm/',
  'https://www.pooltile.com.au/product/linen-travertine-coping/',
  'https://www.pooltile.com.au/product/linen-travertine/',
  'https://www.pooltile.com.au/product/macadamia-travertine-coping/',
  'https://www.pooltile.com.au/product/silver-travertine-coping/',
  'https://www.pooltile.com.au/product/silver-travertine/',
  'https://www.pooltile.com.au/product/macadamia-travertine/',
  'https://www.pooltile.com.au/product/stepedgetiles/',
  'https://www.pooltile.com.au/product/ash-marblano-porcelain-pool-tiles-pavers-coping-ash-marblano-20mm/',
  'https://www.pooltile.com.au/product/ss017-black-quartzite/',
  'https://www.pooltile.com.au/product/cmc475urbanblack-ashlar/',
  'https://www.pooltile.com.au/product/cb415-greek-key-black-and-white-pattern/',
  'https://www.pooltile.com.au/product/silver-shadow-limestonio-grippa-10mm/',
  'https://www.pooltile.com.au/product/cmc553-mossman-green-wavy-23mm/',
  'https://www.pooltile.com.au/product/cmc525poseidon48mmmosaictile/',
  'https://www.pooltile.com.au/product/cmc558-eucalyptus-green-wavy-23mm/',
  'https://www.pooltile.com.au/product/darkgreygranite/',
  'https://www.pooltile.com.au/product/cmc597-blue-gum-48mm/',
  'https://www.pooltile.com.au/product/cmc320bali48mm/',
  'https://www.pooltile.com.au/product/cmc560-ubud-green-wavy-23mm/',
  'https://www.pooltile.com.au/product/externalcornertile/',
  'https://www.pooltile.com.au/product/cmc515-mint-green48mm/',
  'https://www.pooltile.com.au/product/dune-limestone-coping/',
  'https://www.pooltile.com.au/product/venus/',
  'https://www.pooltile.com.au/product/dark-elm-tiledeck/',
  'https://www.pooltile.com.au/product/oak-tiledeck/',
  'https://www.pooltile.com.au/product/silver-elm-tiledeck/',
  'https://www.pooltile.com.au/product/cmc572-sea-mist-48mm-new/',
  'https://www.pooltile.com.au/product/cmc545sukabumi-48mm/',
  'https://www.pooltile.com.au/product/cmc535-blue-wave-48mm/',
  'https://www.pooltile.com.au/product/cmc532-glacier-grey-48mm-new/',
  'https://www.pooltile.com.au/product/cmc530-patagonia-48mm-new/',
  'https://www.pooltile.com.au/product/cmc510-stonehenge48mm/',
  'https://www.pooltile.com.au/product/cmc500-druid-grey-48mm/',
  'https://www.pooltile.com.au/product/cmc450avoca48mm/',
  'https://www.pooltile.com.au/product/cmc440origamifrostmint48mm/',
  'https://www.pooltile.com.au/product/cmc430origami-ice-blue48mm/',
  'https://www.pooltile.com.au/product/cmc420origamidarkgrey48mm/',
  'https://www.pooltile.com.au/product/cmc415carrara48mm/',
  'https://www.pooltile.com.au/product/cmc338poolside-emerald-48mm/',
  'https://www.pooltile.com.au/product/cmc336coralsea48mm/',
  'https://www.pooltile.com.au/product/cmc331atlantic48mm/',
  'https://www.pooltile.com.au/product/cmc310midgrey48mm/',
  'https://www.pooltile.com.au/product/cmc305darkgreymosaic48mm/',
  'https://www.pooltile.com.au/product/cmc105-sapphire-48mm-new/',
  'https://www.pooltile.com.au/product/cmc275mottledmidblue48mm/',
  'https://www.pooltile.com.au/product/cmc269palmbeach48mm/',
  'https://www.pooltile.com.au/product/cmc266currumbin48mm/',
  'https://www.pooltile.com.au/product/cmc150-pale-blue-48mm/',
  'https://www.pooltile.com.au/product/cmc130ice-blue48mm/',
  'https://www.pooltile.com.au/product/cmc127-antique-emerald-48mm/',
  'https://www.pooltile.com.au/product/cmc120black48mm/',
  'https://www.pooltile.com.au/product/cmc105-peppercorn48mm/',
  'https://www.pooltile.com.au/product/cmc101capriblue48mm/',
  'https://www.pooltile.com.au/product/cmc098oceanblue48mm/',
  'https://www.pooltile.com.au/product/cmc095white-48mm/',
  'https://www.pooltile.com.au/product/cmc401luna23x48mm/',
  'https://www.pooltile.com.au/product/cmc131iceblue23x48mm/',
  'https://www.pooltile.com.au/product/cmc595bluegum23mm/',
  'https://www.pooltile.com.au/product/cmc590graphite23mm/',
  'https://www.pooltile.com.au/product/cmc585titanium23mm/',
  'https://www.pooltile.com.au/product/cmc580gunmetalblue23mm/',
  'https://www.pooltile.com.au/product/cmc575-ultramarine-wavy-23mm/',
  'https://www.pooltile.com.au/product/cmc570seamistwavy23mm/',
  'https://www.pooltile.com.au/product/cmc566-carrara-wavy-23mm/',
  'https://www.pooltile.com.au/product/cmc564-ash-grey-wavy-23mm/',
  'https://www.pooltile.com.au/product/cmc555-white-wavy-23mm/',
  'https://www.pooltile.com.au/product/cmc552-vanilla-wavy-23mm/',
  'https://www.pooltile.com.au/product/cmc400luna23mm/',
  'https://www.pooltile.com.au/product/cmc366-shadow-blend-23mm/',
  'https://www.pooltile.com.au/product/cmc363nova-scotia-23mm/',
  'https://www.pooltile.com.au/product/cmc350cuban23mm/',
  'https://www.pooltile.com.au/product/cmc330atlantic23mm/',
  'https://www.pooltile.com.au/product/cmc304darkgrey23mm/',
  'https://www.pooltile.com.au/product/cmc300twilightblue23mm/',
  'https://www.pooltile.com.au/product/cmc660-stonehenge-kit-kat-20mm/',
  'https://www.pooltile.com.au/product/cmc650-frost-white-kit-kat-22mm/',
  'https://www.pooltile.com.au/product/gcr310royalcrystalpearlblend/',
  'https://www.pooltile.com.au/product/gcr305whitecrystalpearlblend/',
  'https://www.pooltile.com.au/product/gc475-mojito-20mm/',
  'https://www.pooltile.com.au/product/gc425onyx/',
  'https://www.pooltile.com.au/product/gc420alpine/',
  'https://www.pooltile.com.au/product/gc240seashell/',
  'https://www.pooltile.com.au/product/gc210peacock/',
  'https://www.pooltile.com.au/product/gc195coconut-ice/',
  'https://www.pooltile.com.au/product/gc182smoketrail/',
  'https://www.pooltile.com.au/product/whitehaven-glass-mosaic-tiles-pool-design/',
  'https://www.pooltile.com.au/product/gc172vomo-blue/',
  'https://www.pooltile.com.au/product/gc105blacksea/',
  'https://www.pooltile.com.au/product/london-grey-marble/',
  'https://www.pooltile.com.au/product/silver-marble/',
  'https://www.pooltile.com.au/product/arctic-dawn/',
  'https://www.pooltile.com.au/product/highland-grey/',
  'https://www.pooltile.com.au/product/havana-white-natural-stone/',
  'https://www.pooltile.com.au/product/dune-limestone/',
  'https://www.pooltile.com.au/product/parisianbluelimestone/',
  'https://www.pooltile.com.au/product/almond-granite/',
  'https://www.pooltile.com.au/product/lightgreygranite/',
  'https://www.pooltile.com.au/product/mushroom-granite/',
  'https://www.pooltile.com.au/product/nimbus-granite/',
  'https://www.pooltile.com.au/product/sandwavegranite/',
  'https://www.pooltile.com.au/product/dark-grey-granite-crazy-pave-new/',
  'https://www.pooltile.com.au/product/nimbus-granite-crazy-pave-new/',
  'https://www.pooltile.com.au/product/linen-travertine-crazy-pave/',
  'https://www.pooltile.com.au/product/silver-travertine-crazy-pave-2/',
  'https://www.pooltile.com.au/product/platinum-travertino-grippa-porcelain/',
  'https://www.pooltile.com.au/product/shoreline-travertino/',
  'https://www.pooltile.com.au/product/rustic-grey-travertino/',
  'https://www.pooltile.com.au/product/platinum-travertino/',
  'https://www.pooltile.com.au/product/coastal-cream-travertino/',
  'https://www.pooltile.com.au/product/sand-drift/',
  'https://www.pooltile.com.au/product/pluto/',
  'https://www.pooltile.com.au/product/jupiter/',
  'https://www.pooltile.com.au/product/bluestone-look-paver-eclipse-blustonio/',
  'https://www.pooltile.com.au/product/cosmos-granito/',
  'https://www.pooltile.com.au/product/coconut-drift/',
  'https://www.pooltile.com.au/product/bianco-marblano-grippa-smooth-non-slip/',
  'https://www.pooltile.com.au/product/carrara-marblano/',
  'https://www.pooltile.com.au/product/bianco-marblano/',
  'https://www.pooltile.com.au/product/ss315-contempo-gold/',
  'https://www.pooltile.com.au/product/ss650-crevasse-loose-walling/',
  'https://www.pooltile.com.au/product/silvertravwalling/',
  'https://www.pooltile.com.au/product/gcr240corduroy/',
  'https://www.pooltile.com.au/product/gc430kimberley/',
  'https://www.pooltile.com.au/product/silver-travertine-skimmer-lid/',
  'https://www.pooltile.com.au/product/macadamia-travertine-skimmer-lid/',
  'https://www.pooltile.com.au/product/highland-grey-coping/',
  'https://www.pooltile.com.au/product/parisian-blue-limestone-coping/',
  'https://www.pooltile.com.au/product/natural-himalayan-sandstone-pool-coping/',
  'https://www.pooltile.com.au/product/almond-granite-cobblestone/',
  'https://www.pooltile.com.au/product/mushroom-granite-cobblestone/',
  'https://www.pooltile.com.au/product/silver-travertine-cobblestone/',
  'https://www.pooltile.com.au/product/flamed-basalt-cobblestone/',
  'https://www.pooltile.com.au/product/light-grey-granite-cobblestone/',
  'https://www.pooltile.com.au/product/dark-grey-granite-cobblestone/',
  'https://www.pooltile.com.au/product/stepping-stones/',
  'https://www.pooltile.com.au/product/silver-travertine-crazy-pave/',
  'https://www.pooltile.com.au/product/sandwave-granite-crazy-pave/',
  'https://www.pooltile.com.au/product/light-grey-granite-crazy-pave-new/',
  'https://www.pooltile.com.au/product/havana-white-marble-pool-coping/',
  'https://www.pooltile.com.au/product/dark-grey-granite-coping/',
  'https://www.pooltile.com.au/product/sandwave-granite-coping/',
  'https://www.pooltile.com.au/product/gc205-kingfisher-20mm/',
  'https://www.pooltile.com.au/product/hamptons-grey-loose-walling/',
  'https://www.pooltile.com.au/product/ss650-crevasse-random-ashlar-walling/',
  'https://www.pooltile.com.au/product/cmc550sukabumi95mm/',
  'https://www.pooltile.com.au/product/silver-travertine-grate/',
  'https://www.pooltile.com.au/product/gc440-mystic/',
  'https://www.pooltile.com.au/product/gc480tempestglassblend/',
  'https://www.pooltile.com.au/product/dive-into-fun-amalfi-crystal-pearl-blend-mosaic/',
  'https://www.pooltile.com.au/product/gcr315skycrystalpearlblend/',
  'https://www.pooltile.com.au/product/gcr320charcoalcrystalpearlblend/',
  'https://www.pooltile.com.au/product/gc445peacockpearlblend/',
  'https://www.pooltile.com.au/product/gc417aspen/',
  'https://www.pooltile.com.au/product/gc102charcoalpearl/',
  'https://www.pooltile.com.au/product/gc215-lorikeet-20mm/',
  'https://www.pooltile.com.au/product/gc472-midori-20mm/',
  'https://www.pooltile.com.au/product/gc452-calypso-20mm/',
  'https://www.pooltile.com.au/product/gc456-mid-blue-trio/',
  'https://www.pooltile.com.au/product/cmc582-gunmetal-blue-48mm/',
  'https://www.pooltile.com.au/product/cmc333-moroccan-green-48mm/',
  'https://www.pooltile.com.au/product/cmc267mooloolaba48mm/',
  'https://www.pooltile.com.au/product/cmc473urban-white-ashlar/',
  'https://www.pooltile.com.au/product/ss635-pearl-loose-walling/',
  'https://www.pooltile.com.au/product/ballarat-gold-loose-walling/',
  'https://www.pooltile.com.au/product/natural-grey-loose-walling/',
  'https://www.pooltile.com.au/product/thredbo-loose-walling/',
  'https://www.pooltile.com.au/product/ss500-kosciuszko/',
  'https://www.pooltile.com.au/product/ss300-contempo-natural-blend/',
  'https://www.pooltile.com.au/product/ss430-natural-grey/',
  'https://www.pooltile.com.au/product/ss515-thredbo/',
  'https://www.pooltile.com.au/product/ss107-black-quartzite-fine/',
  'https://www.pooltile.com.au/product/cmc315light-grey-48mm/',
  'https://www.pooltile.com.au/product/coastal-cream-travertino-grippa-smooth-non-slip/',
  'https://www.pooltile.com.au/product/light-grey-granite-coping/',
  'https://www.pooltile.com.au/product/silver-marble-coping/',
  'https://www.pooltile.com.au/product/silver-marble-skimmer-lid/',
  'https://www.pooltile.com.au/product/linen-travertine-skimmer-lid/',
  'https://www.pooltile.com.au/product/almond-granite-grate/',
  'https://www.pooltile.com.au/product/nimbus-granite-coping/',
  'https://www.pooltile.com.au/product/mushroom-granite-coping/',
  'https://www.pooltile.com.au/product/almond-granite-coping/',
  'https://www.pooltile.com.au/product/sand-drift-coping/',
  'https://www.pooltile.com.au/product/hide-exterior-drain-covers/',
  'https://www.pooltile.com.au/product/noosa-shore-limestone/',
  'https://www.pooltile.com.au/product/calico-travertino-porcelain-20mm/',
  'https://www.pooltile.com.au/product/flax-travertino-20mm/',
  'https://www.pooltile.com.au/product/flax-travertino-grippa-10mm/',
  'https://www.pooltile.com.au/product/calico-travertino-grippa-10mm/',
  'https://www.pooltile.com.au/product/natural-hq-sandstone/',
  'https://www.pooltile.com.au/product/cmc119black23mm/',
  'https://www.pooltile.com.au/product/cmc122mattblack48mm/',
  'https://www.pooltile.com.au/product/cmc340neptune23mm/',
  'https://www.pooltile.com.au/product/cmc360bering-sea23mm/',
  'https://www.pooltile.com.au/product/cmc129iceblue23mm/',
  'https://www.pooltile.com.au/product/cmc259seaspray23mm/',
  'https://www.pooltile.com.au/product/cmc144midnightblue23mm/',
  'https://www.pooltile.com.au/product/cmc335coralsea23mm/',
  'https://www.pooltile.com.au/product/cmc125antiqueaqua23mm/',
  'https://www.pooltile.com.au/product/cmc345bliss23mm/',
  'https://www.pooltile.com.au/product/cmc114white23mm/',
  'https://www.pooltile.com.au/product/cm132bluegreen25mm/',
  'https://www.pooltile.com.au/product/cmc341neptune48mm/',
  'https://www.pooltile.com.au/product/cmc126antiqueaqua48mm/',
  'https://www.pooltile.com.au/product/cmc124antiqueopal48mm/',
  'https://www.pooltile.com.au/product/cmc100mediterraneanblue48mm/',
  'https://www.pooltile.com.au/product/cmc135mid-blue-48mm/',
  'https://www.pooltile.com.au/product/cmc090cyan-blue48mm/',
  'https://www.pooltile.com.au/product/cmc215matt-light-grey-48mm/',
  'https://www.pooltile.com.au/product/cmc268burleigh48mm/',
  'https://www.pooltile.com.au/product/cmc425origami-aqua48mm/',
  'https://www.pooltile.com.au/product/cmc140darkblue48mm/',
  'https://www.pooltile.com.au/product/cmc097mattwhite48mm/',
  'https://www.pooltile.com.au/product/cmc095-int-whiteinternalcornertile/',
  'https://www.pooltile.com.au/product/cmc356-puerto-rico-23mm/',
  'https://www.pooltile.com.au/product/cmc460-terrain-48mm/',
  'https://www.pooltile.com.au/product/cmc093-white-anti-slip-48mm/',
  'https://www.pooltile.com.au/product/cmc149-pale-blue-23mm/',
  'https://www.pooltile.com.au/product/cmc556-white-wavy-48mm/',
  'https://www.pooltile.com.au/product/cmc568-luna-wavy-23mm/',
  'https://www.pooltile.com.au/product/cmc405-autumn-grey-48mm/',
  'https://www.pooltile.com.au/product/cmc343mediterraneansea23mm/',
  'https://www.pooltile.com.au/product/cmc417ash-grey48mm/',
  'https://www.pooltile.com.au/product/cmc455fingal48mm/',
  'https://www.pooltile.com.au/product/cmc205mattdarkgrey48mm/',
  'https://www.pooltile.com.au/product/cmc210mattmidgrey48mm/',
  'https://www.pooltile.com.au/product/cm130iceblue58mm/',
  'https://www.pooltile.com.au/product/cm148pacificblue58mm/',
  'https://www.pooltile.com.au/product/cm133bluegreen58mm/',
  'https://www.pooltile.com.au/product/cm145midnightblue58mm/',
  'https://www.pooltile.com.au/product/cm168green58mm/',
  'https://www.pooltile.com.au/product/cm115glosswhite58mm/',
  'https://www.pooltile.com.au/product/cm127antique-emerald58mm/',
  'https://www.pooltile.com.au/product/cm550sukabumi97mm/',
  'https://www.pooltile.com.au/product/stone-look-pool-tile-cmc402-luna-48mm-ceramic-mosaic/',
  'https://www.pooltile.com.au/product/shoreline-travertino-grippa-smooth-non-slip/',
  'https://www.pooltile.com.au/product/green-loggerhead-sea-turtle/',
  'https://www.pooltile.com.au/product/gc230savannah/',
  'https://www.pooltile.com.au/product/venus-coping/',
  'https://www.pooltile.com.au/product/venus-skimmer-lid/',
  'https://www.pooltile.com.au/product/silver-elm-tiledeck-coping/',
  'https://www.pooltile.com.au/product/silver-elm-tiledeck-skimmer-lid/',
  'https://www.pooltile.com.au/product/shoreline-travertino-coping/',
  'https://www.pooltile.com.au/product/shoreline-travertino-skimmer-lid/',
  'https://www.pooltile.com.au/product/sand-drift-skimmer-lid/',
  'https://www.pooltile.com.au/product/rustic-grey-travertino-coping/',
  'https://www.pooltile.com.au/product/rustic-grey-travertino-skimmer-lid/',
  'https://www.pooltile.com.au/product/pluto-coping/',
  'https://www.pooltile.com.au/product/pluto-skimmer-lid/',
  'https://www.pooltile.com.au/product/platinum-travertino-coping/',
  'https://www.pooltile.com.au/product/platinum-travertino-skimmer-lid/',
  'https://www.pooltile.com.au/product/oak-tiledeck-coping/',
  'https://www.pooltile.com.au/product/oak-tiledeck-skimmer-lid/',
  'https://www.pooltile.com.au/product/mercury-skimmer-lid/',
  'https://www.pooltile.com.au/product/jupiter-grippa-smooth-non-slip/',
  'https://www.pooltile.com.au/product/jupiter-coping/',
  'https://www.pooltile.com.au/product/jupiter-skimmer-lid/',
  'https://www.pooltile.com.au/product/eclipse-blustonio-coping/',
  'https://www.pooltile.com.au/product/eclipse-blustonio-skimmer-lid/',
  'https://www.pooltile.com.au/product/dusk-blustonio-bluestone-look-paver/',
  'https://www.pooltile.com.au/product/dusk-blustonio-coping/',
  'https://www.pooltile.com.au/product/dusk-blustonio-skimmer-lid/',
  'https://www.pooltile.com.au/product/dark-elm-tiledeck-coping/',
  'https://www.pooltile.com.au/product/dark-elm-tiledeck-skimmer-lid/',
  'https://www.pooltile.com.au/product/cosmos-granito-coping/',
  'https://www.pooltile.com.au/product/cosmos-granito-skimmer-lid/',
  'https://www.pooltile.com.au/product/coconut-drift-coping/',
  'https://www.pooltile.com.au/product/coconut-drift-skimmer-lid/',
  'https://www.pooltile.com.au/product/coconut-drift-grippa-smooth-non-slip/',
  'https://www.pooltile.com.au/product/coastal-cream-travertino-coping/',
  'https://www.pooltile.com.au/product/coastal-cream-travertino-skimmer-lid/',
  'https://www.pooltile.com.au/product/carrara-marblano-coping/',
  'https://www.pooltile.com.au/product/carrara-marblano-quad-skimmer-lid-carrara-marblano/',
  'https://www.pooltile.com.au/product/calico-travertino-coping/',
  'https://www.pooltile.com.au/product/bianco-marblano-coping/',
  'https://www.pooltile.com.au/product/bianco-marblano-skimmer-lid/',
  'https://www.pooltile.com.au/product/ash-marblano-coping/',
  'https://www.pooltile.com.au/product/ash-marblano-skimmer-lid/',
  'https://www.pooltile.com.au/product/ash-marblano-grippa/',
  'https://www.pooltile.com.au/product/parisian-blue-limestone-skimmer-lid/',
  'https://www.pooltile.com.au/product/highland-grey-marble-skimmer-lid/',
  'https://www.pooltile.com.au/product/havana-white-marble-skimmer-lid/',
  'https://www.pooltile.com.au/product/arctic-dawn-pool-coping/',
  'https://www.pooltile.com.au/product/arctic-dawn-marble-skimmer-lid/',
  'https://www.pooltile.com.au/product/gb380-mediterranean-blue-and-white-pattern/',
  'https://www.pooltile.com.au/product/gb280-azure-blue-and-white-pattern/',
  'https://www.pooltile.com.au/product/cb800-diamond-pattern/',
  'https://www.pooltile.com.au/product/cb802-reverse-dark-blue-and-white-diamond/',
  'https://www.pooltile.com.au/product/cb806-mid-blue-snake-diamond/',
  'https://www.pooltile.com.au/product/cb112-diamond-black-patttern/',
  'https://www.pooltile.com.au/product/cb108-black-and-white-diamond-pattern/',
  'https://www.pooltile.com.au/product/black-and-white-tide/',
  'https://www.pooltile.com.au/product/cb615-bliss-white-tide-pattern/',
  'https://www.pooltile.com.au/product/cb611-atlantic-white-tide-pattern/',
  'https://www.pooltile.com.au/product/cb614-mediterranean-sea-white-tide-pattern/',
  'https://www.pooltile.com.au/product/cb613-coral-sea-white-pattern/',
  'https://www.pooltile.com.au/product/cb201-blue-crosshatch-pattern/',
  'https://www.pooltile.com.au/product/cb223-dark-grey-crosshatch-pattern/',
  'https://www.pooltile.com.au/product/cb414-greek-key-neptune-and-white-pattern/',
  'https://www.pooltile.com.au/product/cb413-greek-key-blue-white-pattern/',
  'https://www.pooltile.com.au/product/cb416-greek-key-grey-white-pattern/',
  'https://www.pooltile.com.au/product/gb480-p-ocean-wave-pearl/',
  'https://www.pooltile.com.au/product/gc455midblueblend/',
  'https://www.pooltile.com.au/product/gc220daintree/',
  'https://www.pooltile.com.au/product/gc450anglesea/',
  'https://www.pooltile.com.au/product/gc193turquoise-sea/',
  'https://www.pooltile.com.au/product/gc099blackcaramel/',
  'https://www.pooltile.com.au/product/gc177seagreenpearl/',
  'https://www.pooltile.com.au/product/gc130darkbluepearl/',
  'https://www.pooltile.com.au/product/gc144lightgreenpearl/',
  'https://www.pooltile.com.au/product/gc186smoke/',
  'https://www.pooltile.com.au/product/gc148midblue/',
  'https://www.pooltile.com.au/product/gc150midgreyspeckle/',
  'https://www.pooltile.com.au/product/gc149lightgreyspeckle/',
  'https://www.pooltile.com.au/product/gc095black/',
  'https://www.pooltile.com.au/product/gc225forestgreen/',
  'https://www.pooltile.com.au/product/gcr223whitecrystal/',
  'https://www.pooltile.com.au/product/gcr042aquacrystal48mm/',
  'https://www.pooltile.com.au/product/gcr188midnightblue/',
  'https://www.pooltile.com.au/product/gcr210skyblue23mm/',
  'https://www.pooltile.com.au/product/gcr080mid-blue-blendcrystal/',
  'https://www.pooltile.com.au/product/gcr050azure-blue-crystal-23mm/',
  'https://www.pooltile.com.au/product/gcr051azure-blue-crystal-48mm/',
  'https://www.pooltile.com.au/product/gcr041aquablend/',
  'https://www.pooltile.com.au/product/gcr040aquacrystal23mm/',
  'https://www.pooltile.com.au/product/gcr180mediterraneanblue23mm/',
  'https://www.pooltile.com.au/product/gcr049azure23x48mm/',
  'https://www.pooltile.com.au/product/blue-pool-tiles-crystal-48mm-glass-mosaic/',
  'https://www.pooltile.com.au/product/gcr061-graphite-48mm/',
  'https://www.pooltile.com.au/product/gcr215skyblue/',
  'https://www.pooltile.com.au/product/gcr185mediterranean-blue23x48mm/',
  'https://www.pooltile.com.au/product/flax-travertino-skimmer-lid/',
  'https://www.pooltile.com.au/product/calico-travertino-skimmer-lid/',
  'https://www.pooltile.com.au/product/london-grey-marble-coping/',
  'https://www.pooltile.com.au/product/in-pool-tiles/',
  'https://www.pooltile.com.au/product/flax-travertino-coping/',
  'https://www.pooltile.com.au/product/latte-marblano-coping/'
];

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const client = https;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      }
    };
    
    client.get(url, options, (res) => {
      let html = '';
      res.on('data', chunk => html += chunk);
      res.on('end', () => resolve(html));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function parseProduct(html, url) {
  const data = {
    name: url.split('/product/')[1]?.replace(/\//g, '').replace(/-/g, ' ').replace(/\d+mm/g, '').trim() || 'Unknown',
    price: null,
    tileSize: null,
    sheetSize: null,
    category: 'waterline_tile',
    unit: 'm2',
    textureUrl: null,
    supplier: 'PoolTile',
    sourceUrl: url
  };

  try {
    // Extract name from title tag
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      data.name = titleMatch[1]
        .replace(/[-|] The Pool Tile Company/g, '')
        .replace(/[-|] Buy at Pool Tiles Sydney Melbourne Brisbane/g, '')
        .replace(/Buy Online/g, '')
        .trim();
    }

    // Extract price from various patterns
    const pricePatterns = [
      /<span[^>]*class="price"[^>]*>\$\s*(\d+[\.,]?\d*)/i,
      /<span[^>]*class="amount"[^>]*>\$\s*(\d+[\.,]?\d*)/i,
      /\$\s*(\d+[\.,]?\d*)\s*per\s*m/,
      /price["\']?\s*:\s*["\']?\$?(\d+[\.,]?\d*)/i
    ];
    
    for (const pattern of pricePatterns) {
      const match = html.match(pattern);
      if (match) {
        data.price = parseFloat(match[1].replace(',', ''));
        break;
      }
    }

    // Extract tile size (23mm, 48mm, etc.)
    const tileSizeMatch = html.match(/(\d+)mm/i);
    if (tileSizeMatch) {
      data.tileSize = parseInt(tileSizeMatch[1]);
    }

    // Extract sheet dimensions
    const sheetMatch = html.match(/Sheet Size[^:]*:?\s*([\d\sx]+mm?)/i);
    if (sheetMatch) {
      const dims = sheetMatch[1].match(/(\d+)\s*x\s*(\d+)/i);
      if (dims) {
        data.sheetSize = { width: parseInt(dims[1]), height: parseInt(dims[2]) };
      }
    }

    // Extract product image from og:image meta tag (most reliable)
    const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"[^>]*>/i);
    if (ogImageMatch) {
      data.textureUrl = ogImageMatch[1];
      data.thumbnailUrl = ogImageMatch[1];
    } else {
      // Fallback to data-thumb in gallery
      const thumbMatch = html.match(/data-thumb="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
      if (thumbMatch) {
        data.textureUrl = thumbMatch[1];
        data.thumbnailUrl = thumbMatch[1];
      }
    }

    // Infer category from product name
    const nameLower = data.name.toLowerCase();
    if (nameLower.includes('coping')) data.category = 'coping';
    else if (nameLower.includes('paving') || nameLower.includes('paver')) data.category = 'paving';
    else if (nameLower.includes('waterline')) data.category = 'waterline_tile';
    else if (nameLower.includes('skimmer') || nameLower.includes('lid')) data.category = 'accessory';
    else if (nameLower.includes('deck') || nameLower.includes('tile deck')) data.category = 'paving';

  } catch (error) {
    console.error(`Error parsing ${url}:`, error.message);
  }

  return data;
}

async function createMaterial(data) {
  try {
    const payload = {
      name: data.name,
      category: data.category,
      unit: data.unit,
      price: data.price,
      cost: data.price ? (data.price * 0.85) : null,
      tile_width_mm: data.tileSize,
      tile_height_mm: data.tileSize,
      sheet_width_mm: data.sheetSize?.width,
      sheet_height_mm: data.sheetSize?.height,
      texture_url: data.textureUrl,
      thumbnail_url: data.thumbnailUrl,
      supplier: data.supplier,
      source_url: data.sourceUrl
    };

    const urlObj = new URL('http://localhost:3000/api/materials');
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };
    
    const res = await httpRequest(urlObj.href, options, JSON.stringify(payload));

    let result;
    try {
      result = res.json();
    } catch (e) {
      result = res.data;
    }
    
    return { success: res.ok, data: result, error: res.ok ? null : result?.error || result?.message || 'Unknown error' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log(`\n🚀 Starting bulk import of ${materialUrls.length} materials...\n`);
  
  const results = { success: 0, failed: 0, errors: [] };
  
  for (let i = 0; i < materialUrls.length; i++) {
    const url = materialUrls[i];
    const progress = `[${i + 1}/${materialUrls.length}]`;
    
    try {
      console.log(`${progress} Fetching: ${url}`);
      const html = await fetchPage(url);
      
      console.log(`${progress} Parsing product data...`);
      const product = parseProduct(html, url);
      
      console.log(`${progress} Creating material: ${product.name}`);
      const result = await createMaterial(product);
      
      if (result.success) {
        results.success++;
        console.log(`${progress} ✅ Success: ${product.name}\n`);
      } else {
        results.failed++;
        results.errors.push({ url, name: product.name, error: result.error });
        console.log(`${progress} ❌ Failed: ${product.name} - ${result.error}\n`);
      }
      
      // Rate limiting: 500ms delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      results.failed++;
      results.errors.push({ url, error: error.message });
      console.log(`${progress} ❌ Error: ${error.message}\n`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${results.success}`);
  console.log(`❌ Failed: ${results.failed}`);
  
  if (results.errors.length > 0) {
    console.log('\n⚠️  Failed imports:');
    results.errors.slice(0, 10).forEach(err => {
      console.log(`  - ${err.name || err.url}: ${err.error}`);
    });
    if (results.errors.length > 10) {
      console.log(`  ... and ${results.errors.length - 10} more`);
    }
  }
  
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
