/* PAR ORDO PRO — «Джарвис» V3.0.0: голосовой помощник — браслеты, покупки, вопросы по сайту, сам предупреждает, мужской голос.
   Подключение: <script src="./par-ordo-jarvis-v1.js?v=3.0.0" defer></script> — после всех остальных скриптов.
   Работает через функции приложения (activateRoom, addPurchase, changeQty). Живой голос — Worker V10.20 (по желанию).
   Примеры: «3 браслет активный кыл», «Вход взрослый кош», «Бирге жарма кош», «5 номерге 2 кола», «Отмена». */
(function () {
  'use strict';
  const VERSION = '3.0.0';

  /* =====================================================================
     ЯДРО: разбор фразы → действия. Чистые функции, без DOM.
     Понимает русский, кыргызский и казахский (как их пишет распознавание речи).
     ===================================================================== */

  const KZ_LETTERS = { 'і': 'и', 'ә': 'э', 'ғ': 'г', 'қ': 'к', 'ң': 'н', 'ө': 'о', 'ұ': 'у', 'ү': 'у', 'һ': 'х', 'ё': 'е', 'ъ': '' };

  function norm(text) {
    let s = String(text == null ? '' : text).toLowerCase();
    s = s.replace(/[іәғқңөұүһёъ]/g, ch => KZ_LETTERS[ch]);
    s = s.replace(/[№#]/g, ' номер ');
    s = s.replace(/(\d)[.,](\d)/g, '$1\u0001$2');
    s = s.replace(/(\d)([^\d\s\u0001])/g, '$1 $2').replace(/([^\d\s\u0001])(\d)/g, '$1 $2');
    s = s.replace(/[^a-zа-я0-9\u0001\s]+/g, ' ');
    s = s.replace(/\u0001/g, '.');
    return s.replace(/\s+/g, ' ').trim();
  }

  /* ---------- латиница → кириллица (бренды и общая транслитерация) ---------- */
  const BRANDS = {
    legend: ['легенда', 'легенд'], tien: ['тянь'], shan: ['шань'],
    coca: ['кока'], cola: ['кола'], cocacola: ['кока кола', 'кокакола', 'кола'], pepsi: ['пепси'],
    sprite: ['спрайт'], majito: ['мохито', 'можито', 'мажито'], mojito: ['мохито', 'можито'],
    fanta: ['фанта'], fusetea: ['фьюз ти', 'фьюзти', 'фьюз', 'фуз ти'], fuse: ['фьюз'], fuze: ['фьюз'],
    tea: ['ти'], ice: ['айс'], lipton: ['липтон'], mirinda: ['миринда'], flash: ['флеш', 'флэш'],
    mactea: ['мак ти', 'макти', 'мак чай'], maccoffee: ['мак кофе', 'маккофе', 'мак кофи'], mac: ['мак'], coffee: ['кофе'],
    forx: ['форкс', 'форекс', 'форс'], men: ['мен', 'мэн'], for: ['фор'], pro: ['про'], series: ['сериес', 'сириес', 'серия', 'сериз'],
    viking: ['викинг'], clear: ['клир', 'клеар'], nivea: ['нивея', 'нивеа'], axe: ['акс', 'акса', 'аксе'], rexona: ['рексона'],
    misvak: ['мисвак'], miswak: ['мисвак'], colgate: ['колгейт', 'колгейд'], blendamed: ['блендамед'], aquafresh: ['аквафреш'],
    sensodyne: ['сенсодин'], splat: ['сплат'], lacalut: ['лакалют'], oral: ['орал'], b: ['би'], dove: ['дав', 'дове'],
    palmolive: ['палмолив', 'пальмолив'], safeguard: ['сейфгард'], lux: ['люкс'], camay: ['камей'], head: ['хед'],
    shoulders: ['шолдерс'], pantene: ['пантин', 'пантене'], gliss: ['глисс'], elseve: ['эльсев'], syoss: ['сьосс'],
    schauma: ['шаума'], gillette: ['жиллет', 'жилет'], bic: ['бик'], venus: ['винус', 'венус'], old: ['олд'], spice: ['спайс'],
    adidas: ['адидас'], nike: ['найк'], puma: ['пума'], fa: ['фа'], deonica: ['деоника'], garnier: ['гарньер', 'гарнье'],
    tac: ['так', 'тач'], ozdilek: ['оздилек'], energy: ['энерджи'], shot: ['шот'], active: ['актив'], protection: ['протекшн'],
    bross: ['бросс', 'брос'], lacoste: ['лакост'], tom: ['том'], tailor: ['тейлор'], jarvis: ['джарвис']
  };
  const LAT_MULTI = [['sch', 'щ'], ['tch', 'ч'], ['sh', 'ш'], ['ch', 'ч'], ['zh', 'ж'], ['kh', 'х'], ['ts', 'ц'], ['ya', 'я'], ['yu', 'ю'],
    ['yo', 'е'], ['ye', 'е'], ['ph', 'ф'], ['th', 'т'], ['ck', 'к'], ['qu', 'кв'], ['oo', 'у'], ['ee', 'и'], ['ea', 'и'], ['ou', 'у'],
    ['ai', 'ей'], ['ay', 'ей'], ['ey', 'ей'], ['ow', 'оу']];
  const LAT_ONE = { a: 'а', b: 'б', c: 'к', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и', j: 'дж', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о',
    p: 'п', q: 'к', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'кс', y: 'и', z: 'з' };
  function translit(word) {
    let out = '';
    for (let i = 0; i < word.length;) {
      const pair = LAT_MULTI.find(([lat]) => word.startsWith(lat, i));
      if (pair) { out += pair[1]; i += pair[0].length; continue; }
      const ch = word[i];
      if (ch === 'c' && /[eiy]/.test(word[i + 1] || '')) out += 'с';
      else out += LAT_ONE[ch] || ch;
      i += 1;
    }
    return out;
  }
  // All spoken variants of a Latin word (first one is used for speech recognition text).
  function latinVariants(word) {
    if (BRANDS[word]) return BRANDS[word];
    return [translit(word)];
  }

  /* ---------- синонимы (рус. / кырг. / каз.) → одно каноническое слово ---------- */
  const SYNONYMS = [
    ['вход', 'входа', 'входы', 'входов', 'входной', 'входные', 'кируу', 'кирууну', 'кириш', 'киришке', 'билет', 'билета', 'билеты', 'кiру', 'киру'],
    ['взрослый', 'взрослая', 'взрослое', 'взрослые', 'взрослого', 'взрослому', 'взрослых', 'взрослым', 'чондор', 'чондорго', 'чондордун', 'улуу', 'улкендер', 'ересек'],
    ['детский', 'детская', 'детское', 'детские', 'детского', 'детскому', 'детских', 'детским', 'ребенок', 'ребенка', 'ребенку', 'дети', 'детей', 'бала', 'балага', 'балдар', 'балдарга', 'балдардын', 'бобок', 'балалар'],
    ['черный', 'черная', 'черного', 'черную', 'кара'],
    ['зеленый', 'зеленая', 'зеленого', 'зеленую', 'кок', 'жашыл'],
    ['вода', 'воды', 'воду', 'водой', 'суу', 'сууну', 'су'],
    ['минеральная', 'минеральной', 'минеральную', 'минералка', 'минералки', 'минералку', 'минерал', 'минералды', 'газированная'],
    ['хлеб', 'хлеба', 'хлебушек', 'нан', 'нанды', 'лепешка', 'лепешку', 'лепешки'],
    ['полотенце', 'полотенца', 'полотенец', 'сулгу', 'орамал'],
    ['мыло', 'мыла', 'самын', 'сабын'],
    ['носки', 'носков', 'носок', 'байпак', 'шулук'],
    ['мужские', 'мужской', 'мужская', 'мужских', 'эркек', 'эркектер', 'эркектин', 'ер'],
    ['одноразовые', 'одноразовый', 'одноразовая', 'одноразовых', 'одноразовую', 'одноразка'],
    ['клубника', 'клубникой', 'клубнику', 'клубничная', 'клубничный', 'кулпунай'],
    ['персик', 'персиковая', 'персиковый', 'шабдалы'],
    ['мята', 'мятой', 'мятная', 'мятный', 'жалбыз'],
    ['лимон', 'лимоном', 'лимонная', 'лимонный', 'лимондуу'],
    ['манго', 'маракуйя', 'маракуйей'],
    ['веник', 'веника', 'веники', 'шыпыргы'],
    ['чай', 'чаю', 'чая', 'чайку', 'чайы', 'ти'],
    ['кофе', 'кофи', 'кофейку'],
    ['бритва', 'бритву', 'бритвы', 'станок', 'станка', 'устара'],
    ['сидушка', 'сидение', 'сиденье', 'подстилка', 'отургуч', 'сидушки', 'сидушку'],
    ['шорты', 'шорт', 'шортики', 'шортылар'],
    ['трусы', 'трусов', 'трусики', 'трусики', 'трусишки', 'ич кийим'],
    ['майка', 'майку', 'майки', 'футболка', 'футболку', 'футболки'],
    ['паста', 'пасту', 'пасты', 'пастасы'],
    ['щетка', 'щетку', 'щетки', 'щеточка'],
    ['мочалка', 'мочалку', 'мочалки', 'жуунгуч'],
    ['шампунь', 'шампуня', 'шампуни', 'шампунчик', 'шампундан'],
    ['дезодорант', 'дезодоранта', 'дезик', 'дезодор', 'дизодорант'],
    ['салфетки', 'салфетка', 'салфеток', 'салфетку', 'влажные', 'влажная'],
    ['шапка', 'шапку', 'шапки', 'калпак', 'топу'],
    ['самса', 'самсу', 'самсы', 'самсе'],
    ['шашлык', 'шашлыка', 'шашлыки', 'кебаб'],
    ['энергетик', 'энергетика', 'энергетики', 'энергос']
  ];
  const SYN_EXACT = new Map();
  const SYN_PREFIX = [];
  SYNONYMS.forEach(group => group.forEach(word => {
    SYN_EXACT.set(word, group[0]);
    if (word.length >= 5 && !word.includes(' ')) SYN_PREFIX.push([word, group[0]]);
  }));
  SYN_PREFIX.sort((a, b) => b[0].length - a[0].length);
  function canon(token) {
    if (SYN_EXACT.has(token)) return SYN_EXACT.get(token);
    for (const [word, base] of SYN_PREFIX) {
      if (token.length > word.length && token.startsWith(word) && token.length - word.length <= 5) return base;
    }
    return token;
  }

  /* ---------- размеры ---------- */
  const SIZE_WORD = { s: 's', m: 'm', l: 'l', xs: 'xs', xl: 'xl', xxl: '2xl', xxxl: '3xl', xxxxl: '4xl', эс: 's', эм: 'm', эль: 'l', эл: 'l', иксэль: 'xl', иксэс: 'xs', хл: 'xl' };
  const SIZE_CYR_SHORT = { с: 's', м: 'm', л: 'l' };
  const SIZE_MULT = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, два: 2, две: 2, двойной: 2, дабл: 2, double: 2, эки: 2, еки: 2, три: 3, тройной: 3, уч: 3, уш: 3, четыре: 4, торт: 4, пять: 5, беш: 5, бес: 5, шесть: 6, алты: 6 };
  const SMALL_WORDS = /^(маленьк|кичине|кичинекей|кишкентай|мини$|малень)/;
  const BIG_WORDS = /^(больш|крупн|улкон|чон$|чонун$)/;
  const SIZE_CONTEXT = /^(трус|майк|футбол|шорт|носк|шампун|форкс|клир|нивея|размер)/;
  const HALF_SIZE = new Set(['0.5', '0.50', '.5']);

  /* ---------- служебные слова ---------- */
  const WAKE = new Set(['джарвис', 'жарвис', 'дарвис', 'чарвис', 'жарвиз', 'джарвиз', 'джервис', 'жервис', 'джарвиса', 'jarvis']);
  const FILLER = new Set(('кош кошуп кошуу кошкула кошкун кошчу кошу кошо кошь каш кошунуз коштум коюп кой коюу салып салгыла кос косу косып косыныз ' +
    'добавь добавить добавьте добавим добавил добавила добавляй добавляем добавлю добавлять запиши запишите запишем пробей пробейте положи дай дайте ' +
    'плюс еще ище дагы дагыда тагы тагыда жана жане да менен мен пожалуйста плиз пожалуста ' +
    'ага ок окей так ну вот это эту этот эти бул ошол ошону тиги анан потом затем также тоже а но или же ли бы ' +
    'кыл кылып кылгыла кылчы кылыныз кылуу кылабыз кылдым жаса жасап жаса сделай сделать сделайте делай ет етып етиниз ' +
    'мне нам ему ей им мага бизге сага ооба эми азыр сейчас быстро тез давай давайте ' +
    'клиент клиенту клиента клиентке клиентти клиентин клиентка ' +
    'алло слушай эй хорошо жакшы рахмат спасибо бер бериниз берчи берип керек нужно надо ' +
    'не нет жок кил ке ка ге га го ко ни ны ну ду ди ды ту ты де та до то ' + [...WAKE].join(' ')).split(/\s+/).filter(Boolean));
  const YES = new Set(['да', 'ооба', 'иэ', 'ия', 'конечно', 'ага', 'окей', 'ок', 'туура', 'давай', 'давайте', 'макул']);
  const SKIP = new Set(['с', 'со', 'для', 'и', 'в', 'во', 'на', 'из', 'к', 'ко', 'по', 'у', 'от', 'о', 'об']);
  const PREP_BEFORE_ROOM = new Set(['на', 'в', 'во', 'к', 'ко', 'для']);
  const NEG = new Set(['не', 'нет', 'жок', 'отмена', 'отмени', 'кереги', 'жокко']);
  const RANGE_WORD = /^(до|по|чейин|дейре|дейин|дейинки)$/;
  const MARKER = /^(браслет|бранслет|браслед|брослет|браслит|номер|номур|нумер|номир|комнат)/;
  const UNIT = /^(штук|шт$|даана|дана$|данасы|даанасын|пачк|бутыл|ботолко|бутулка|стакан|порци|кружк|раз$|раза$|кесе|тал$|данаа)/;
  const PRICE_UNIT = /^(сом|сомдук|сомго|сома|сомов|теңге|тенге|рубл)/;
  const INTENT_RULES = [
    ['deactivate', /^(неактив|деактив|освобод|бошот|жап$|жабып|жапкыла|жабуу|закр|заверш|бутур|бутуп|бутургула|аякта)/],
    ['undo', /^(отмен|отмини|аннулир|назад$|артка$|кайтар|жокко$|удал|убер|убра|очур|очурп|сотри|стереть|кайра ал)/],
    ['activate', /^(актив|выда[йтюмч]|выдать|запуст|старт$|включ|белсенд|иштет|баштa)/],
    ['open', /^(откр|ач$|ачып|ачыл|ачкыла|ачуу$|ачыныз|аш$|ашып|ашу$)/],
    ['show', /^(покаж|показ|корсот|чек$|счет$|итог$)/]
  ];

  /* ---------- числа ---------- */
  const RU_CARD = {
    ноль: 0, нуль: 0, один: 1, одна: 1, одно: 1, одну: 1, одного: 1, одному: 1, одной: 1, одним: 1,
    два: 2, две: 2, двух: 2, двум: 2, двумя: 2, три: 3, трех: 3, трем: 3, тремя: 3, четыре: 4, четырех: 4, четырем: 4,
    пять: 5, пяти: 5, шесть: 6, шести: 6, семь: 7, семи: 7, восемь: 8, восьми: 8, девять: 9, девяти: 9,
    десять: 10, десяти: 10, одиннадцать: 11, одиннадцати: 11, двенадцать: 12, двенадцати: 12, тринадцать: 13, тринадцати: 13,
    четырнадцать: 14, четырнадцати: 14, пятнадцать: 15, пятнадцати: 15, шестнадцать: 16, шестнадцати: 16,
    семнадцать: 17, семнадцати: 17, восемнадцать: 18, восемнадцати: 18, девятнадцать: 19, девятнадцати: 19,
    двадцать: 20, двадцати: 20, тридцать: 30, тридцати: 30
  };
  const ORD_END = '(ый|ий|ой|ая|ое|ого|ому|ую|ом|ые|ых|ым)';
  const RU_ORD = [
    ['одиннадцат', 11], ['двенадцат', 12], ['тринадцат', 13], ['четырнадцат', 14], ['пятнадцат', 15], ['шестнадцат', 16],
    ['семнадцат', 17], ['восемнадцат', 18], ['девятнадцат', 19], ['двадцат', 20], ['тридцат', 30],
    ['перв', 1], ['втор', 2], ['четверт', 4], ['пят', 5], ['шест', 6], ['седьм', 7], ['восьм', 8], ['девят', 9], ['десят', 10]
  ].map(([stem, value]) => [new RegExp('^' + stem + ORD_END + '$'), value]);
  RU_ORD.push([/^трет(ий|ья|ье|ьего|ьему|ьей|ью|ьем|ьи|ьих)$/, 3]);
  const KY_STEMS = [['жыйырма', 20], ['жийирма', 20], ['жиырма', 20], ['жырма', 20], ['отуз', 30], ['отыз', 30], ['сегиз', 8],
    ['тогуз', 9], ['тогыз', 9], ['алты', 6], ['жети', 7], ['торт', 4], ['беш', 5], ['бес', 5], ['бир', 1], ['эки', 2], ['еки', 2],
    ['уч', 3], ['уш', 3], ['он', 10]];
  const KY_ORD = /^(ы|и|у|е|о)?н(ч|ш)(ы|и|у)/;
  const KY_CASE = /^(га|ге|го|ка|ке|ко|гу|ку|на|не|но|ны|ни|ну|ды|ди|ду|ты|ти|ту|да|де|до|та|те|то|дан|ден|дон|тан|тен|тон|нан|нен|нон|нын|нин|нун|дын|дин|дун|тын|тин|тун|сы|си|су|сына|сине|суна)$/;
  const DIGIT_SUFFIX_KY = /^((ы|и|у|е|о)?н?(ч|ш)(ы|и|у))?(га|ге|го|ка|ке|ко|гу|ку|ны|ни|ну|ды|ди|ду|ты|ти|ту|да|де|до|та|те|то|дан|ден|дон|тан|тен|тон|сы|си|су)?$/;
  const DIGIT_SUFFIX_RU = /^(й|я|ой|ый|ий|ая|ое|ого|ему|ому|му|го|ую|ом|ым|ых)$/;
  const ABLATIVE = /(дан|ден|дон|тан|тен|тон|нан|нен)$/;

  function kyNumber(token, vocab) {
    for (const [stem, value] of KY_STEMS) {
      if (!token.startsWith(stem)) continue;
      let rest = token.slice(stem.length);
      if (!rest) {
        if (vocab && vocab.has(token)) return null;      // a catalogue word, not a number
        return { value, ord: false, kase: '', bare: true };
      }
      let ord = false;
      const m = rest.match(KY_ORD);
      if (m) { ord = true; rest = rest.slice(m[0].length); }
      if (!rest) return { value, ord, kase: '' };
      if (KY_CASE.test(rest)) return { value, ord, kase: rest };
      return null;
    }
    return null;
  }
  function ruNumber(token) {
    if (Object.prototype.hasOwnProperty.call(RU_CARD, token)) return { value: RU_CARD[token], ord: false, kase: '' };
    for (const [re, value] of RU_ORD) if (re.test(token)) return { value, ord: true, kase: /(ому|ему|ой)$/.test(token) ? 'dat' : '' };
    return null;
  }

  /* ---------- сходство слов ---------- */
  const PH = { а: 'а', о: 'а', я: 'а', е: 'и', э: 'и', и: 'и', ы: 'и', й: 'и', у: 'у', ю: 'у', б: 'п', п: 'п', в: 'ф', ф: 'ф',
    г: 'к', к: 'к', х: 'к', д: 'т', т: 'т', ж: 'ш', ш: 'ш', щ: 'ш', з: 'с', с: 'с', ц: 'с', ч: 'ч', л: 'л', м: 'м', н: 'н', р: 'р' };
  function phon(word) {
    let out = '';
    for (const ch of word) {
      const m = PH[ch];
      if (m === undefined) { if (/[0-9a-z_]/.test(ch)) out += ch; continue; }
      if (out[out.length - 1] !== m) out += m;
    }
    return out;
  }
  function lev(a, b) {
    if (a === b) return 0;
    const n = a.length, m = b.length;
    if (!n) return m; if (!m) return n;
    let prev = new Array(m + 1), cur = new Array(m + 1);
    for (let j = 0; j <= m; j++) prev[j] = j;
    for (let i = 1; i <= n; i++) {
      cur[0] = i;
      for (let j = 1; j <= m; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      [prev, cur] = [cur, prev];
    }
    return prev[m];
  }
  const SIZE_NEAR = { sz_small: { sz_half: 0.95, sz_s: 0.9, sz_xs: 0.85 }, sz_big: { sz_m: 0.8, sz_l: 0.8, sz_xl: 0.75 } };
  // Word endings: Kyrgyz/Kazakh case and possessive suffixes (жарма+ны, самса+дан), Russian endings.
  const SUFFIX_PIECE = '(ны|ни|ну|ды|ди|ду|ты|ти|ту|га|ге|го|гу|ка|ке|ко|ку|да|де|до|та|те|то|дан|ден|дон|тан|тен|тон|нан|нен|нон|' +
    'нын|нин|нун|дын|дин|дун|тын|тин|тун|сы|си|су|сын|син|сун|на|не|лар|лер|дар|дер|тар|тер|лор|дор|тор|' +
    'а|у|ы|и|е|о|ю|я|ой|ей|ом|ем|ам|ям|ами|ах|ов|ев|ью|ку|ки|чик|ик|очку|ечку)';
  const SUFFIX_ONE = new RegExp('^' + SUFFIX_PIECE + '$');
  const SUFFIX_RE = { test: rest => SUFFIX_ONE.test(rest) || (rest.length >= 4 && splitsLong(rest)) };
  function splitsLong(rest) {
    for (let k = 2; k <= rest.length - 2; k++) if (SUFFIX_ONE.test(rest.slice(0, k)) && SUFFIX_ONE.test(rest.slice(k))) return true;
    return false;
  }
  const RU_ENDING = /^(а|у|ы|и|е|о|ю|я|ой|ей|ом|ем|ам|ям|ами|ах|ов|ев|ью|ь|ку|ки)$/;
  const ADJ_END = /(ая|яя|ый|ий|ой|ое|ее|ые|ие)$/;
  const ADJ_FORM = /^(ая|яя|ую|юю|ой|ей|ый|ий|ое|ее|ые|ие|ого|его|ому|ему|ых|их|ым|им|ыми|ими)$/;
  function tokSim(a, b) {
    if (a === b) return 1;
    const sa = a.startsWith('sz_'), sb = b.startsWith('sz_');
    if (sa || sb) return (sa && sb && SIZE_NEAR[a] && SIZE_NEAR[a][b]) || 0;
    const la = a.length, lb = b.length;
    if (lb >= 3 && la > lb && a.startsWith(b) && SUFFIX_RE.test(a.slice(lb))) return 0.95;        // жарма+ны, чай+ды
    if (la >= 4 && b.startsWith(a) && lb - la <= 2) return 0.9;                                  // клубник ≈ клубника
    if (lb >= 4 && la >= lb - 1) {                                                               // жарму ≈ жарма, колы ≈ кола
      const stem = b.slice(0, lb - 1);
      if (a.startsWith(stem) && RU_ENDING.test(a.slice(stem.length))) return 0.88;
    }
    if (lb >= 5 && ADJ_END.test(b)) {                                                            // живую ≈ живая
      const stem = b.slice(0, lb - 2);
      if (a.startsWith(stem) && ADJ_FORM.test(a.slice(stem.length))) return 0.88;
    }
    const pa = phon(a), pb = phon(b);
    if (pa === pb && pa.length >= 3) return 0.92;
    const maxl = Math.max(pa.length, pb.length);
    if (maxl < 4) return 0;
    const s = 1 - lev(pa, pb) / maxl;
    if (s < 0.74) return 0;
    // the written words must also be close (майка ≠ манго, шоро ≠ жарма)
    const raw = 1 - lev(a, b) / Math.max(la, lb);
    return raw >= 0.6 ? s * 0.95 : 0;
  }

  /* ---------- разбор фразы на слова ---------- */
  function rawTokens(text) {
    const words = norm(text).split(' ').filter(Boolean);
    const out = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      // «3 в 1», «три в одном» — часть названия кофе/чая, не число
      if ((w === '3' || w === 'три' || w === 'уч') && words[i + 1] === 'в' && /^(1|один|одном|одном)$/.test(words[i + 2] || '')) { i += 2; continue; }
      out.push(w);
    }
    return out;
  }

  function lex(text, vocab) {
    const words = rawTokens(text);
    const toks = [];
    const push = (t, kind, extra) => toks.push(Object.assign({ t, c: t, kind }, extra || {}));
    for (let i = 0; i < words.length; i++) {
      const w = words[i], next = words[i + 1] || '', prev = words[i - 1] || '';
      if (WAKE.has(w)) continue;
      // размеры: «2 икс эль», «xxl», «размер эм», «трусы м»
      const mult = SIZE_MULT[w];
      if (mult && (next === 'xl' || next === 'хл' || next === 'иксэль' || ((next === 'икс' || next === 'экс') && /^(эль|л|l)$/.test(words[i + 2] || '')))) {
        push('sz_' + mult + 'xl', 'size'); i += next === 'икс' || next === 'экс' ? 2 : 1; continue;
      }
      if ((w === 'икс' || w === 'экс') && (next === 'икс' || next === 'экс') && /^(эль|л|l)$/.test(words[i + 2] || '')) { push('sz_2xl', 'size'); i += 2; continue; }
      if ((w === 'икс' || w === 'экс') && /^(эль|л|l)$/.test(next)) { push('sz_xl', 'size'); i += 1; continue; }
      if ((w === 'икс' || w === 'экс') && /^(эс|с|s)$/.test(next)) { push('sz_xs', 'size'); i += 1; continue; }
      if (/^[2-6]xl$/.test(w)) { push('sz_' + w, 'size'); continue; }
      const sizeCtx = SIZE_CONTEXT.test(prev) || SIZE_CONTEXT.test(words[i - 2] || '');
      if (SIZE_WORD[w] && (/^[a-z]+$/.test(w) || w === 'иксэль' || w === 'иксэс' || w === 'хл' || sizeCtx)) { push('sz_' + SIZE_WORD[w], 'size'); continue; }
      if (SIZE_CYR_SHORT[w] && sizeCtx) { push('sz_' + SIZE_CYR_SHORT[w], 'size'); continue; }
      if (w === 'размер' || w === 'размера' || w === 'размеры' || w === 'олчому' || w === 'олчом') { push(w, 'skip'); continue; }
      // 0,5 л / ноль пять / пол литра
      if (HALF_SIZE.has(w)) { push('sz_half', 'size'); if (/^(л|литр|литра|литров|литровая|литровую)$/.test(next)) i += 1; continue; }
      if ((w === 'ноль' || w === '0') && (next === 'пять' || next === '5')) { push('sz_half', 'size'); i += 1; if (/^(л|литр|литра)$/.test(words[i + 1] || '')) i += 1; continue; }
      if (/^(поллитр|поллитра|поллитровая|поллитровую|полулитров|пол-литр)/.test(w) || (w === 'пол' && /^литр/.test(next))) { push('sz_half', 'size'); if (w === 'пол') i += 1; continue; }
      if (/^(1\.5|полтора)$/.test(w)) { push('sz_big', 'soft'); if (/^(л|литр|литра)$/.test(next)) i += 1; continue; }
      if (/^(л|литр|литра|литров|литровая|литровую|литровый)$/.test(w)) { push(w, 'skip'); continue; }
      if (SMALL_WORDS.test(w)) { push('sz_small', 'soft'); continue; }
      if (BIG_WORDS.test(w)) { push('sz_big', 'soft'); continue; }
      // «алып сал», «алып таштa» — убрать
      if (w === 'алып' && /^(сал|сал|таш|кой)/.test(next)) { push('алып сал', 'intent', { intent: 'undo' }); i += 1; continue; }
      if (w === 'кайра' && /^ал/.test(next)) { push('кайра ал', 'intent', { intent: 'undo' }); i += 1; continue; }
      if (/^\d+$/.test(w)) {
        const tok = { t: w, c: w, kind: 'num', value: Number(w), ord: false, kase: '' };
        if (next && next.length <= 7 && (DIGIT_SUFFIX_RU.test(next) || (DIGIT_SUFFIX_KY.test(next) && next.length >= 2))) {
          tok.kase = next; tok.ord = /(ч|ш)(ы|и|у)/.test(next) || DIGIT_SUFFIX_RU.test(next); i += 1;
        }
        toks.push(tok); continue;
      }
      if ((w === 'x' || w === 'х') && /^\d+$/.test(next)) { push(w, 'unit', { times: true }); continue; }
      if (/^[a-z]+$/.test(w)) {
        const variant = latinVariants(w)[0];
        variant.split(' ').forEach(part => push(part, 'word', { c: canon(part), lat: w }));
        continue;
      }
      const intent = INTENT_RULES.find(([, re]) => re.test(w));
      if (intent && !(intent[0] === 'open' && w === 'ач' && /^(чай|чайга)$/.test(next))) { push(w, 'intent', { intent: intent[0] }); continue; }
      if (MARKER.test(w)) { push(w, 'marker'); continue; }
      if (PRICE_UNIT.test(w)) { push(w, 'price'); continue; }
      if (UNIT.test(w)) { push(w, 'unit'); continue; }
      if (RANGE_WORD.test(w)) { push(w, 'range'); continue; }
      const ru = ruNumber(w);
      if (ru) { toks.push({ t: w, c: w, kind: 'num', value: ru.value, ord: ru.ord, kase: ru.kase }); continue; }
      const ky = kyNumber(w, vocab);
      if (ky) { toks.push({ t: w, c: w, kind: 'num', value: ky.value, ord: ky.ord, kase: ky.kase, bare: !!ky.bare }); continue; }
      if (QWORD.test(w)) { push(w, 'filler', { q: true }); continue; }
      if (!(vocab && vocab.has(w)) && isKeyword(w)) { push(w, 'kw'); continue; }
      if (SKIP.has(w)) { push(w, 'skip'); continue; }
      if (FILLER.has(w) || YES.has(w)) { push(w, 'filler', { neg: NEG.has(w), yes: YES.has(w) }); continue; }
      push(w, 'word', { c: canon(w) });
    }
    return mergeNumbers(toks);
  }

  // «двадцать пять», «жыйырма беш», «он бир» → одно число
  function mergeNumbers(toks) {
    const out = [];
    for (let i = 0; i < toks.length; i++) {
      const a = toks[i], b = toks[i + 1];
      if (a.kind === 'num' && b && b.kind === 'num' && [10, 20, 30].includes(a.value) && !a.kase && !a.ord && b.value >= 1 && b.value <= 9
        && !/^\d+$/.test(a.t)) {
        out.push({ t: a.t + ' ' + b.t, c: a.t + ' ' + b.t, kind: 'num', value: a.value + b.value, ord: b.ord, kase: b.kase });
        i += 1; continue;
      }
      out.push(a);
    }
    // Bare Kyrgyz «он» without a neighbour number is the Russian pronoun «он».
    const res = out.map(t => (t.kind === 'num' && t.t === 'он' && t.bare ? Object.assign({}, t, { kind: 'filler' }) : t));
    // «3 часа», «уч сааттан» — a duration, not a bracelet or a quantity
    res.forEach((t, i) => { if (t.kind === 'num' && res[i + 1] && /^(час|часа|часов|часик|саат|сааттан|саатка|минут|мин$)/.test(res[i + 1].t)) t.kind = 'duration'; });
    return res;
  }

  /* ---------- каталог: индекс названий ---------- */
  const NAME_NOISE = new Set(['для', 'с', 'со', 'и', 'в', 'на', 'размер', 'л', 'мл', 'шт', 'бани', 'баня', 'бане', 'тела', 'пара']);
  function productTokenLists(name) {
    // Returns alias token lists (raw + canonical) for one product name.
    const words = rawTokens(name);
    const slots = [];   // each slot: array of alternatives, each alternative = array of raw tokens
    for (let i = 0; i < words.length; i++) {
      const w = words[i], next = words[i + 1] || '';
      if (/^[2-6]$/.test(w) && next === 'xl') { slots.push([['sz_' + w + 'xl']]); i += 1; continue; }
      if (/^[2-6]xl$/.test(w)) { slots.push([['sz_' + w]]); continue; }
      if (/^(s|m|l|xs|xl|xxl|xxxl)$/.test(w)) { slots.push([['sz_' + SIZE_WORD[w]]]); continue; }
      if (HALF_SIZE.has(w)) { slots.push([['sz_half']]); continue; }
      if (/^\d+$/.test(w) || NAME_NOISE.has(w)) continue;
      if (/^[a-z]+$/.test(w)) { slots.push(latinVariants(w).map(v => v.split(' '))); continue; }
      slots.push([[w]]);
    }
    if (!slots.length) return [];
    let lists = [[]];
    for (const slot of slots) {
      const next = [];
      for (const list of lists) for (const alt of slot) next.push(list.concat(alt));
      lists = next.slice(0, 12);
    }
    const seen = new Set();
    return lists.filter(list => { const key = list.join(' '); if (seen.has(key)) return false; seen.add(key); return true; });
  }

  const SAY_SIZE = { s: 'эс', m: 'эм', l: 'эль', xs: 'икс эс', xl: 'икс эль', xxl: 'два икс эль', xxxl: 'три икс эль' };
  function sayName(name) {
    return String(name || '').replace(/[|—–-]+/g, ' ')
      .replace(/(^|\s)([2-6])\s?xl(?=\s|$)/gi, (m, sp, n) => `${sp}${n} икс эль`)
      .replace(/(^|\s)(s|m|l|xs|xl|xxl|xxxl)(?=\s|$)/gi, (m, sp, w) => sp + SAY_SIZE[w.toLowerCase()])
      .replace(/[A-Za-z]+/g, w => latinVariants(w.toLowerCase())[0])
      .replace(/\s+/g, ' ').trim();
  }
  const SIZE_RANK = { sz_xs: 0, sz_s: 1, sz_m: 2, sz_l: 3, sz_xl: 4, sz_2xl: 5, sz_3xl: 6, sz_4xl: 7, sz_5xl: 8, sz_6xl: 9, sz_half: 1 };

  function buildIndex(products, learned) {
    const list = (Array.isArray(products) ? products : []).filter(p => p && p.id != null && String(p.name || '').trim());
    const items = [];
    const entryAlias = toks => ({ raw: toks, c: toks.map(canon) });
    items.push({ ref: 'entry:adult', kind: 'entry', entry: 'adult', name: 'Вход', say: 'вход взрослый',
      aliases: [['вход'], ['вход', 'взрослый'], ['взрослый', 'вход'], ['взрослый']].map(entryAlias) });
    items.push({ ref: 'entry:child', kind: 'entry', entry: 'child', name: 'Вход детский', say: 'вход детский',
      aliases: [['вход', 'детский'], ['детский', 'вход'], ['детский']].map(entryAlias) });
    const groups = new Map();
    for (const p of list) {
      const lists = productTokenLists(p.name);
      if (!lists.length) continue;
      const it = { ref: 'p:' + Number(p.id), kind: 'product', id: Number(p.id), name: String(p.name), say: sayName(p.name),
        price: p.price == null ? null : Number(p.price), aliases: lists.map(raw => ({ raw, c: raw.map(canon) })) };
      const sizeTok = lists[0].find(r => SIZE_RANK[r] != null);
      it.sizeRank = sizeTok ? SIZE_RANK[sizeTok] : -1;
      items.push(it);
      const key = norm(p.name);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(it);
    }
    // Same name twice (the Worker strips «0.5 л»): the cheaper one is «0,5 л».
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const price = it => (it.price == null ? Infinity : it.price);
      const sorted = group.slice().sort((a, b) => price(a) - price(b) || b.id - a.id);
      if (price(sorted[0]) === price(sorted[sorted.length - 1])) continue;
      const small = sorted[0];
      small.tag = '0,5 л';
      small.say = small.say + ' 0,5';
      const base = small.aliases.slice();
      small.aliases = [];
      base.forEach(al => {
        small.aliases.push({ raw: al.raw.concat('sz_half'), c: al.c.concat('sz_half') });
        al.c.forEach((c, k) => small.aliases.push({ raw: [al.raw[k], 'sz_half'], c: [c, 'sz_half'] }));
      });
      sorted.slice(1).forEach(it => { it.dupMain = it === sorted[sorted.length - 1]; it.dupKey = norm(it.name); });
      small.dupKey = norm(small.name);
    }
    // Weights: rare words matter more (IDF over products).
    const products_ = items.filter(it => it.kind === 'product');
    const df = new Map();
    products_.forEach(it => {
      const seen = new Set();
      it.aliases.forEach(al => al.c.forEach(c => seen.add(c)));
      seen.forEach(c => df.set(c, (df.get(c) || 0) + 1));
    });
    const N = Math.max(products_.length, 1);
    const weight = c => 1 + Math.log(N / Math.max(1, df.get(c) || 1));
    items.forEach(it => it.aliases.forEach(al => {
      al.w = al.c.map(c => (it.kind === 'entry' ? 1 : weight(c)));
      al.total = al.w.reduce((s, v) => s + v, 0);
    }));
    const vocab = new Set();
    products_.forEach(it => it.aliases.forEach(al => al.raw.forEach(r => vocab.add(r))));
    const learnedMap = new Map();
    Object.entries(learned || {}).forEach(([phrase, ref]) => { if (items.some(it => it.ref === ref)) learnedMap.set(phrase, ref); });
    const byRef = new Map(items.map(it => [it.ref, it]));
    return { items, byRef, vocab, learned: learnedMap, size: products_.length };
  }

  /* ---------- сопоставление отрезка фразы с товаром ---------- */
  function scoreAlias(span, al) {
    const used = new Uint8Array(al.c.length);
    let M = 0, matched = 0, hasSize = false;
    for (const s of span) {
      if (s.kind === 'skip') continue;
      let bk = -1, bv = 0;
      for (let k = 0; k < al.c.length; k++) {
        if (used[k]) continue;
        const v = tokSim(s.c, al.c[k]);
        if (v > bv) { bv = v; bk = k; }
      }
      if (bv >= 0.74) { used[bk] = 1; M += bv * al.w[bk]; matched += 1; if (al.c[bk].startsWith('sz_')) hasSize = true; }
      else if (s.kind === 'word' || s.kind === 'size') return concatScore(span, al);
    }
    if (!matched) return null;
    return { cov: M / al.total, matched, hasSize };
  }
  function concatScore(span, al) {
    const spoken = span.filter(s => s.kind === 'word');
    if (!spoken.length) return null;
    if (span.some(s => s.kind === 'size' && !al.c.includes(s.c))) return null;   // a spoken size must exist in the name
    const a = phon(spoken.map(s => s.t).join(''));
    const b = phon(al.raw.filter(r => !r.startsWith('sz_')).join(''));
    if (a.length < 5 || !b) return null;
    const sim = 1 - lev(a, b) / Math.max(a.length, b.length);
    if (sim >= 0.84) return { cov: sim, matched: spoken.length, hasSize: false, concat: true };
    return null;
  }
  function spanCandidates(span, index) {
    const words = span.filter(s => s.kind !== 'skip' && s.kind !== 'filler');
    const phrase = words.map(s => s.c).join(' ');
    const learnedRef = index.learned.get(phrase);
    const out = [];
    for (const it of index.items) {
      let best = null;
      for (const al of it.aliases) {
        const r = scoreAlias(span, al);
        if (r && (!best || r.cov > best.cov)) best = r;
      }
      if (learnedRef === it.ref) best = { cov: 1.25, matched: Math.max(1, words.length), learned: true };
      if (best) out.push(Object.assign({ item: it }, best));
    }
    out.sort((a, b) => b.cov - a.cov || (b.item.dupMain ? 1 : 0) - (a.item.dupMain ? 1 : 0));
    return out;
  }
  function judge(cands) {
    if (!cands.length) return null;
    const top = cands[0];
    if (top.learned) return { status: 'strong', pick: top, conf: 1 };
    // Only one name (or one name in two sizes): choose without asking.
    const dupKeys = new Set(cands.map(c => c.item.dupKey || c.item.ref));
    if (dupKeys.size === 1 && cands.length > 1) {
      const half = cands.find(c => c.item.tag && c.hasSize);
      const pick = half || cands.find(c => c.item.dupMain) || top;
      return { status: 'strong', pick, conf: Math.max(pick.cov, 0.75) };
    }
    if (cands.length === 1) return { status: 'strong', pick: top, conf: Math.max(top.cov, 0.75) };
    const second = cands[1];
    const gap = top.cov - second.cov;
    if ((top.cov >= 0.5 && gap >= 0.15) || (top.cov >= 0.85 && gap >= 0.08)) return { status: 'strong', pick: top, conf: top.cov };
    const options = cands.filter(c => c.cov >= top.cov * 0.35 && !(c.item.tag && !c.hasSize && cands.some(d => d.item.dupMain && d.item.dupKey === c.item.dupKey)))
      .slice(0, 9)
      .sort((a, b) => (Math.abs(a.cov - b.cov) > 0.04 ? b.cov - a.cov : 0) || ((a.item.sizeRank ?? -1) - (b.item.sizeRank ?? -1)) || ((a.item.id || 0) - (b.item.id || 0)));
    return { status: 'ambiguous', options, conf: top.cov };
  }

  // Best non-overlapping set of product spans (weighted interval scheduling).
  function matchSpans(toks, index) {
    const n = toks.length;
    const isContent = t => t.kind === 'word' || t.kind === 'size' || t.kind === 'soft';
    const canJoin = t => isContent(t) || t.kind === 'skip' || t.kind === 'filler';
    const spans = [];
    for (let i = 0; i < n; i++) {
      if (!isContent(toks[i])) continue;
      for (let j = i; j < n && j < i + 7; j++) {
        if (!canJoin(toks[j])) break;
        const endsOnCatalogFiller = toks[j].kind === 'filler' && index.vocab.has(toks[j].t);
        if (!isContent(toks[j]) && !endsOnCatalogFiller) continue;
        const span = toks.slice(i, j + 1);
        const contentCount = span.filter(isContent).length;
        if (contentCount > 5) break;
        if (!span.some(t => t.kind === 'word' || t.kind === 'size')) continue;
        const verdict = judge(spanCandidates(span, index));
        if (!verdict) continue;
        const m = verdict.status === 'strong' ? verdict.pick.matched : verdict.options[0].matched;
        if (endsOnCatalogFiller && m <= contentCount) continue;   // the filler did not belong to the name
        if (verdict.status === 'strong' && m < contentCount) {
          // a soft word (маленький / большой) that matched nothing is fine; an unmatched real word is not
          const unmatchedReal = span.filter(t => t.kind === 'word' || t.kind === 'size').length > m;
          if (unmatchedReal && !verdict.pick.concat) continue;
        }
        const bonus = 1 + 0.15 * (m - 1);
        const w = (verdict.status === 'strong' ? verdict.conf : 0.55 * verdict.conf) * m * bonus;
        spans.push({ i, j, verdict, w });
      }
    }
    const best = new Array(n + 1).fill(0), choice = new Array(n + 1).fill(null);
    for (let i = n - 1; i >= 0; i--) {
      best[i] = best[i + 1]; choice[i] = null;
      for (const s of spans) {
        if (s.i !== i) continue;
        const v = s.w + best[s.j + 1];
        if (v > best[i] + 1e-9) { best[i] = v; choice[i] = s; }
      }
    }
    const picked = [];
    for (let i = 0; i < n;) {
      if (choice[i]) { picked.push(choice[i]); i = choice[i].j + 1; } else i += 1;
    }
    return picked;
  }

  /* ---------- главный разбор ---------- */
  function parse(text, index, ctx) {
    ctx = ctx || {};
    const heard = String(text || '').trim();
    const toks = lex(heard, index.vocab);
    const intents = new Set(toks.filter(t => t.kind === 'intent').map(t => t.intent));
    const picked = matchSpans(toks, index);
    const covered = new Uint8Array(toks.length);
    picked.forEach(s => { for (let k = s.i; k <= s.j; k++) covered[k] = 1; });
    const spanAt = k => picked.find(s => s.i <= k && k <= s.j) || null;

    // Numbers: bracelet or quantity?
    // Each «браслет/номер» word binds to one number: the one right before it («5 номерге», «биринчи браслетке»),
    // otherwise the one right after it («номер 5», «браслет 5»).
    const roles = new Map();   // token index -> 'room' | 'qty' | 'unknown'
    const passable = t => t.kind === 'filler' || t.kind === 'skip' || t.kind === 'marker';
    toks.forEach((t, k) => {
      if (t.kind !== 'marker') return;
      let bound = -1;
      for (let q = k - 1, steps = 0; q >= 0 && steps < 3; q--) {
        if (toks[q].kind === 'num') { bound = q; break; }
        if (!passable(toks[q])) break;
        if (toks[q].kind !== 'marker') steps += 1;
      }
      if (bound < 0) {
        for (let q = k + 1, steps = 0; q < toks.length && steps < 3; q++) {
          if (toks[q].kind === 'num') { bound = q; break; }
          if (!passable(toks[q])) break;
          if (toks[q].kind !== 'marker') steps += 1;
        }
      }
      if (bound >= 0) roles.set(bound, 'room');
    });
    toks.forEach((t, k) => {
      if (t.kind !== 'num' || roles.has(k)) return;
      const prev = toks[k - 1], next = toks[k + 1];
      const caseRoom = t.kase && !ABLATIVE.test(t.kase);
      const prepRoom = prev && prev.kind === 'skip' && PREP_BEFORE_ROOM.has(prev.t) && !(next && next.kind === 'unit');
      if (t.ord || caseRoom || prepRoom) roles.set(k, 'room');
    });
    // range «с 1 по 5», «1ден 5ке чейин»
    const ranges = [];
    toks.forEach((t, k) => {
      if (t.kind !== 'num') return;
      for (let q = k + 1; q < toks.length && q <= k + 3; q++) {
        if (toks[q].kind === 'num') {
          const between = toks.slice(k + 1, q);
          const after = toks[q + 1];
          const abl = ABLATIVE.test(t.kase || '');
          if (between.some(b => b.kind === 'range') || (abl && (between.length === 0 || (after && after.kind === 'range')))) {
            ranges.push([k, q]); roles.set(k, 'room'); roles.set(q, 'room');
          }
          break;
        }
      }
    });
    const nextContent = k => { for (let q = k + 1; q < toks.length; q++) { if (toks[q].kind === 'filler') continue; return q; } return -1; };
    const prevContent = k => { for (let q = k - 1; q >= 0; q--) { if (toks[q].kind === 'filler') continue; return q; } return -1; };
    const anyRoom = () => [...roles.values()].includes('room');
    const qtyOwner = new Map();   // quantity token index -> span it belongs to
    toks.forEach((t, k) => {
      if (t.kind !== 'num' || roles.has(k)) return;
      const after = toks[nextContent(k)];
      if ((after && after.kind === 'price') || t.value > 50) roles.set(k, 'price');
    });
    toks.forEach((t, k) => {
      if (t.kind !== 'num' || roles.has(k)) return;
      const nq = nextContent(k), pq = prevContent(k);
      const before = pq >= 0 ? toks[pq] : null, after = nq >= 0 ? toks[nq] : null;
      if ((after && after.kind === 'unit') || (before && before.kind === 'unit' && before.times)) { roles.set(k, 'qty'); return; }
      const startsSpan = after && covered[nq] && spanAt(nq) && spanAt(nq).i === nq;
      const endsSpan = before && covered[pq] && spanAt(pq) && spanAt(pq).j === pq && !(after && covered[nq]);
      if (startsSpan || endsSpan) {
        // «25 самса» is bracelet №25 with one samsa; «2 самса» is two samsas.
        const role = t.value > 10 && t.value <= 36 && !anyRoom() ? 'room' : 'qty';
        roles.set(k, role);
        if (role === 'qty') qtyOwner.set(k, startsSpan ? spanAt(nq) : spanAt(pq));
      }
    });
    // A leftover number is the bracelet (once), or every number when activating several.
    toks.forEach((t, k) => {
      if (t.kind !== 'num' || roles.has(k)) return;
      if (t.value >= 1 && t.value <= 36 && (!anyRoom() || intents.has('activate') || intents.has('open'))) roles.set(k, 'room');
      else roles.set(k, 'unknown');
    });

    // Bracelet anchors (with ranges expanded)
    const anchors = [];
    const inRange = new Set();
    ranges.forEach(([a, b]) => {
      const lo = Math.min(toks[a].value, toks[b].value), hi = Math.max(toks[a].value, toks[b].value);
      if (hi - lo <= 12) for (let v = lo; v <= hi; v++) anchors.push({ pos: a, room: v });
      inRange.add(a); inRange.add(b);
    });
    toks.forEach((t, k) => { if (roles.get(k) === 'room' && !inRange.has(k)) anchors.push({ pos: k, room: t.value }); });
    anchors.sort((a, b) => a.pos - b.pos || a.room - b.room);
    const validRooms = anchors.filter(a => a.room >= 1 && a.room <= 36);
    const badRooms = anchors.filter(a => !(a.room >= 1 && a.room <= 36)).map(a => a.room);
    const roomFor = pos => {
      let left = null, right = null;
      anchors.forEach(a => { if (a.pos <= pos) left = a; else if (!right) right = a; });
      return (left || right) ? (left || right).room : null;
    };
    // Quantity for each span: a number right before (or right after) the span.
    const qtyFor = s => {
      for (const [k, owner] of qtyOwner) if (owner === s) return { qty: toks[k].value, k };
      // «2 штуки жарма» / «жарма 2 штуки»: a number next to a unit word
      const pq = prevContent(s.i), nq = nextContent(s.j);
      for (const k of [pq, nq]) {
        if (k < 0) continue;
        if (roles.get(k) === 'qty' && !qtyOwner.has(k)) return { qty: toks[k].value, k };
        if (toks[k].kind === 'unit') {
          const n = k === pq ? prevContent(k) : nextContent(k);
          const m = k === pq ? -1 : prevContent(k);
          for (const q of [n, m]) if (q >= 0 && roles.get(q) === 'qty' && !qtyOwner.has(q)) return { qty: toks[q].value, k: q };
        }
      }
      return { qty: 1, k: -1 };
    };
    const usedQty = new Set();
    const items = [], questions = [];
    picked.forEach(s => {
      let q = qtyFor(s);
      if (q.k >= 0 && usedQty.has(q.k)) q = { qty: 1, k: -1 };
      if (q.k >= 0) usedQty.add(q.k);
      const text = toks.slice(s.i, s.j + 1).filter(t => t.kind !== 'filler').map(t => t.lat || t.t).join(' ');
      const base = { pos: s.i, room: roomFor(s.i), qty: Math.max(1, q.qty || 1), text };
      if (s.verdict.status === 'strong') {
        const it = s.verdict.pick.item;
        items.push(Object.assign(base, { ref: it.ref, conf: s.verdict.conf, phrase: toks.slice(s.i, s.j + 1).filter(t => t.kind !== 'skip' && t.kind !== 'filler').map(t => t.c).join(' ') }));
      } else {
        questions.push(Object.assign(base, { kind: 'product', options: s.verdict.options.map(o => o.item.ref),
          phrase: toks.slice(s.i, s.j + 1).filter(t => t.kind !== 'skip' && t.kind !== 'filler').map(t => t.c).join(' ') }));
      }
    });
    // Unknown words
    const unknown = [], unknownCanon = [];
    toks.forEach((t, k) => {
      if (covered[k]) return;
      if (t.kind === 'word' && t.t.length >= 2) { unknown.push(t.lat || t.t); unknownCanon.push(t.c); }
      if (t.kind === 'num' && roles.get(k) === 'unknown') unknown.push(t.t);
    });
    // Actions
    const actions = [];
    const roomsAll = [...new Set(anchors.map(a => a.room))];
    const know = detectKnowledge({ toks, intents, items, questions, roomsAll, heard });
    if (know) {
      return { heard, actions: [know], questions: [], unknown: [], unknownPhrase: '', badRooms, neg: false, yes: false,
        quality: know.topic === 'unknown_q' ? 0.5 : 3, tokens: toks, knowledge: true };
    }
    const ctxRoom = ctx.room || null;
    if (intents.has('activate') || (intents.has('open') && !items.length && !questions.length)) {
      const type = intents.has('activate') ? 'activate' : 'open';
      actions.push({ type, rooms: roomsAll });
    }
    if (intents.has('deactivate')) actions.push({ type: 'deactivate', rooms: roomsAll.length ? roomsAll : (ctxRoom ? [ctxRoom] : []) });
    if (intents.has('show') && !items.length) actions.push({ type: 'show', rooms: roomsAll.length ? roomsAll : (ctxRoom ? [ctxRoom] : []) });
    const removing = intents.has('undo');
    if (items.length) {
      const byRoom = new Map();
      items.forEach(it => {
        const room = it.room || (intents.has('activate') && roomsAll.length === 1 ? roomsAll[0] : null);
        const key = room == null ? 'ctx' : String(room);
        if (!byRoom.has(key)) byRoom.set(key, { room, items: [] });
        byRoom.get(key).items.push(it);
      });
      byRoom.forEach(group => actions.push({ type: removing ? 'remove' : 'add', room: group.room, items: group.items }));
    } else if (removing && !questions.length) {
      actions.push({ type: 'undo' });
    }
    questions.forEach(q => { if (q.room == null && intents.has('activate') && roomsAll.length === 1) q.room = roomsAll[0]; q.remove = removing; });
    if (!actions.length && !questions.length && roomsAll.length) actions.push({ type: 'select', rooms: roomsAll });
    const neg = toks.length > 0 && toks.every(t => t.kind === 'filler' || (t.kind === 'intent' && t.intent === 'undo')) && toks.some(t => t.neg || t.intent === 'undo');
    const yes = toks.length > 0 && toks.every(t => t.kind === 'filler') && toks.some(t => t.yes) && !toks.some(t => t.neg);
    const quality = actions.length * 2 + items.reduce((s, it) => s + Math.min(1, it.conf), 0) - unknown.length * 1.5 - questions.length * 0.5 + (roomsAll.length ? 0.5 : 0);
    return { heard, actions, questions, unknown, unknownPhrase: unknownCanon.join(' '), badRooms, neg, yes, quality, tokens: toks };
  }


  /* ---------- вопросы, разделы сайта и подсказки ---------- */
  const QWORD_PREFIX = /^(котор|скольк)/;
  const QWORD_EXACT = /^(сколько|скольк|канча|канчасы|канчалык|канчадан|какой|какая|какое|какие|каких|каким|какую|которы|котор|кайсы|кайсыл|кайсынысы|кто|кого|кому|ким|кимде|кимдин|кимге|что|чего|чем|эмне|эмнелер|эмнени|эмнеде|есть|бар|барбы|барпы|жокпу|жокбу|ачыкпы|ачыкбы|ачыктыбы|болдубу|келдиби|буттубу|калдыбы|когда|качан|где|кайда|почем|скажи|скажите|айт|айтчы|айтып|айтыныз|расскажи|доложи|отчитайся|узнай|проверь|текшер|текшерчи|подскажи|ли|бы|бу|пы|пу|мы|бо)$/;
  const QWORD = { test: w => QWORD_EXACT.test(w) || QWORD_PREFIX.test(w) };
  const ADD_VERB = /^(кош|кошу|кошуп|кошо|кошкула|кошчу|кошь|каш|кошунуз|коштум|добав|запиш|пробей|положи|кос$|косу|косып|косыныз|плюс)/;
  const NAV_VERB = /^(перейд|перейт|зайд|зайт|кир$|кирип|киргиз|от$|отуп|отко|переход|ачыңыз)/;
  const HOWTO = /^(как$|кантип|каким|научи|инструкц|объясни|тушундур|кантит|подскажи)$/;
  const GREET = /^(привет|приветствую|здравствуй|здравствуйте|салам|саламатсызбы|саламатсыз|салем|ассалам|ассаламу|хай|hello|добрый|доброе|кандайсыз|кандайсын)$/;
  const THANKS = /^(спасибо|спасиб|благодарю|рахмат|рахмет|ыракмат|сау|молодец|молодчина|красавчик|отлично|супер)$/;
  const WHO = /^(кто ты|ты кто|кимсин|кимсиз)$/;
  const HELP = /^(помощь|помоги|хелп|help|жардам|умеешь|умеете|можешь|аласын|аласыз|функции|команды|буйрук|буйруктар)$/;
  const SUMMARY = /^(дела|делишки|нового|новенького|новости|доложи|доклад|сводк|сводка|сводку|обстановк|ситуаци|статус|абал|жагдай|кабар|брифинг|отчитайся)/;
  const ROOM_INFO = /^(что|эмне|чек|счет|счёт|сумм|долг|должен|должны|карыз|время|времени|убакыт|кто|ким|кимде|сколько|канча|покупк|купил|алды|алган|сатып|жатат|отурат|бар$|состав|позици|тоолой|толойт|төлөйт|платит|оплат)/;
  const OVERTIME_W = /^(вышло|вышел|кончил|закончилось|закончил|истекл|истек|просроч|лимит|ашты|ашкан|ашып|откон|өткөн|бутту|больше|ашык|переси)/;
  const TIME_W = /^(врем|час$|часа$|часов$|саат|убакыт)/;
  const DATE_W = /^(дата|число|числа|день|кун$|күн$|неше|канчасы|какое число|день недели)$/;
  const BOOKING_W = /^(брон|бронь|запис|резерв|брондо|бронирован)/;
  const FIND_W = /^(найди|найти|ищи|поищи|поиск|тап$|тапчы|тапкыла|тапчыы|изде|издеп|издечи|телефон|контакт|номер телефона)/;
  const BONUS_W = /^бонус/;
  const BASE_W = /^(база|базу|базы|базе|базасы|базага|базада|базадан|базасын|crm|клуб|клубу|клубда)$/;
  const CLIENT_W = /^(клиент|кардар|гост|посетител|адам|людей|человек|кишилер)/;
  const EXPENSE_W = /^(расход|чыгым|затрат|трат)/;
  const PROFIT_W = /^(прибыл|пайда|маржа|чистая|чистыми|рентаб)/;
  const REPORT_W = /^(отчет|отчёт|итог|выручк|касс|смен|жыйынтык|доход|заработ|отчот)/;
  const SALES_W = /^(продаж|продал|продан|продает|продаёт|продается|продаётся|продали|сатыл|саттык|сатты|сатылды|топ$|популяр|хит$|хиты|ходов|лидер)/;
  const PRICE_W = /^(цен|стоит|стоимост|почем|почём|баа$|баасы|бааны|турат|канчадан)/;
  const STOCK_W = /^(остат|остал|калд|калган|наличи|склад|запас|закончил|кончил|заканчива|кончает|бутту|тугонд|тугон|мало$|аз$|нету|нет в)/;
  const LOW_W = /^(заканчива|кончает|мало$|аз$|азыраак|кончаются|заканчиваются)/;
  const OUT_W = /^(закончил|кончил|бутту|тугонд|тугон|нету|ноль|нулевой)/;
  const ENTRY_W = /^(вход|входов|входа|входы|кируу|кириш|взросл|детск|дети|детей|бала|балдар|ребен|ребён)/;
  const FREE_W = /^(свобод|бош$|бош|пуст)/;
  const ACTIVE_W = /^(актив|сейчас|азыр|бане$|банеде|ичинде|занят|находятся|жатышат)/;
  const REVENUE_W = /^(выручк|касс|деньг|акча|наличн|налка|нал$|перевод|безнал|оплачен|оплат|заработ|доход|киреше|тушкон|сумм|итог|жыйынтык|долг|карыз|неоплач|ожида|толонбогон|средний|чек$)/;
  const SHIFT_W = /^(смен|кезмет)/;
  const OPEN_W = /^(открой|откройте|открыть|открывай|открываем|открою|ач|ачуу|ачып|ачкыла|ачыныз|начать|начни|начнем|башта|баштайлы|баштагыла)$/;
  const CLOSE_W = /^(закрой|закройте|закрыть|закрывай|закрою|жап|жапкыла|жабуу|жабып|заверши|завершить|завершай|бутур|бутургула|аякта|закончи|закончить)$/;
  const SHIFT_STATE = /^(открыт|закрыт|ачык|ачыкпы|жабык|жабыкпы|ачылды|ачылдыбы|жабылды|статус|работает|иштейби)/;
  const KEYWORDS = () => [SUMMARY, PROFIT_W, EXPENSE_W, REVENUE_W, STOCK_W, PRICE_W, SALES_W, BOOKING_W, FIND_W, BONUS_W, BASE_W, CLIENT_W,
    SHIFT_W, FREE_W, TIME_W, HELP, THANKS, GREET, HOWTO, ...PERIODS.map(p => p[1]), ...NAV_TARGETS.map(n => n[1]),
    /^(контрол|раздел|страниц|экран|панел|управлени|обстанов)/];
  let KEYWORD_LIST = null;
  function isKeyword(w) { if (!KEYWORD_LIST) KEYWORD_LIST = KEYWORDS(); return KEYWORD_LIST.some(re => re.test(w)); }
  const PERIODS = [
    ['yesterday', /^(вчера|вчераш|кечээ|кечее|кече$|кечээки|кечеги|прошл|предыдущ|последн)/],
    ['week', /^(недел|жума|жумалык)/],
    ['month', /^(месяц|месяч|айлык|айда|айдагы|айына|ай$)/],
    ['today', /^(сегодня|сегодняш|бугун|бугунку|сейчас|азыр)/]
  ];
  const NAV_TARGETS = [
    ['daily', /^(ежедневн|кундолук|кунделик)/],
    ['stats', /^статистик/],
    ['ceo', /^(ceo|сео|сиио|двойник|digital|диджитал|twin|твин)$/],
    ['customers', BASE_W],
    ['qr', /^(qr|кр$|кьюар|кюар|куар|сканер|скан$|сканирова)/],
    ['clean', /^(клин|клиин|уборк|тазалык|тазалоо|clean)/],
    ['manager', /^(руковод|жетекчи|директор|владел|начальник|босс)/],
    ['profit', /^(прибыл|пайда)/],
    ['productsView', /^(товар|склад|остатк|поступлен|кампа|продукц|каталог)/],
    ['historyView', /^(истори|тарых)/],
    ['archiveView', /^архив/],
    ['reportView', /^(итог|отчет|отчёт|отчот|касса$|кассу$|жыйынтык|завершени)/],
    ['expensesView', /^(расход|чыгым|затрат)/],
    ['menu', /^меню/],
    ['homeView', /^(номера$|главн|башкы|браслеты$|браслеттер$|домой|уйго|начало)/],
    ['exit', /^(вернись|вернуться|вернуть|выйди|выйти|выход|кайт|кайтуу|кайтып|кайткыла)$/]
  ];
  const FAQ = [
    { id: 'close_shift', all: [/^(закр|жап|жаб|заверш|бутур|аякта|законч)/, SHIFT_W] },
    { id: 'open_shift', all: [/^(откр|ач|начат|начн|башта)/, SHIFT_W] },
    { id: 'complete', all: [/^(закр|жап|жаб|заверш|бутур|аякта|законч)/, /^(клиент|браслет|визит|кардар)/] },
    { id: 'new_product', all: [/^(нов|добав|кош|создат|жаны|жаңы|завест)/, /^(товар|каталог|продукт|позици)/] },
    { id: 'receipt', all: [/^(поступл|приход|принять|принимат|кабыл|завоз|завез|оприход)/] },
    { id: 'register', all: [/^(регистр|зарегистр|катта|каттоо|добав|кош|сохран|записат)/, /^(клиент|кардар|баз|гост)/] },
    { id: 'expense', all: [EXPENSE_W] },
    { id: 'bonus', all: [BONUS_W] },
    { id: 'payment', all: [/^(оплат|толо|налич|перевод|оплач|деньг|акча)/] },
    { id: 'qr', all: [/^(qr|кр$|скан|кьюар|кюар|go$)/] },
    { id: 'manager', all: [/^(руковод|жетекчи)/] },
    { id: 'clean', all: [/^(клин|уборк|тазал)/] },
    { id: 'archive', all: [/^архив/] },
    { id: 'activate', all: [/^(выда|актив|браслет)/] },
    { id: 'add_purchase', all: [/^(добав|кош|покуп|товар|продат|продаж|сат)/] },
    { id: 'jarvis', all: [/^(джарвис|жарвис|голос|микрофон|говорить|сүйлө|суйло)/] }
  ];

  function detectKnowledge(env) {
    const { toks, intents, items, questions, roomsAll, heard } = env;
    const anyTok = re => toks.some(t => re.test(t.t) || (t.c !== t.t && re.test(t.c)) || (t.lat && re.test(t.lat)));
    const words = toks.filter(t => t.kind !== 'filler' && t.kind !== 'skip');
    const qword = anyTok(QWORD);
    const addVerb = anyTok(ADD_VERB);
    const navVerb = toks.some(t => (t.kind === 'intent' && (t.intent === 'open' || (t.intent === 'show' && /^(покаж|показ|корсот)/.test(t.t)))) || NAV_VERB.test(t.t));
    const productRefs = items.map(i => i.ref).concat(questions.flatMap(q => q.options));
    const products = productRefs.filter(r => r.startsWith('p:'));
    const entries = productRefs.filter(r => r.startsWith('entry:'));
    const uniq = list => [...new Set(list)];
    let period = 'today';
    for (const [name, re] of PERIODS) if (anyTok(re)) { period = name; break; }
    const ask = (topic, extra) => Object.assign({ type: 'ask', topic, period, refs: uniq(products), entries: uniq(entries), rooms: roomsAll.slice() }, extra || {});
    const two = (a, b) => { const i = toks.findIndex(t => a.test(t.t)); return i >= 0 && toks[i + 1] && b.test(toks[i + 1].t); };
    const lower = String(heard || '').toLowerCase();

    // social
    if (!products.length && !roomsAll.length) {
      if (anyTok(THANKS) && words.length <= 4) return ask('thanks');
      if (/кто ты|ты кто|сен кимсин|сиз кимсиз|что ты такое/.test(norm(lower))) return ask('who');
      if (anyTok(HELP) || /что ты умеешь|эмне кыла аласын|что можешь/.test(norm(lower))) return ask('help');
      if (anyTok(GREET) && words.length <= 4 && !anyTok(SUMMARY)) return ask('greet');
    }
    // how-to: «как закрыть смену», «кантип товар кошом»
    if (anyTok(HOWTO) || (anyTok(/^(где|кайда)$/) && !products.length && !roomsAll.length)) {
      if (!two(/^как$/, /^(дела|делишки|жизнь)$/)) {
        let best = null;
        for (const f of FAQ) {
          if (f.all.every(re => anyTok(re))) { best = f; break; }
        }
        if (best) return ask('howto', { faq: best.id });
        const navWhere = NAV_TARGETS.find(([, re]) => anyTok(re));
        if (navWhere) return ask('where', { target: navWhere[0] });
      }
    }
    // shift: status, open, close
    if (anyTok(SHIFT_W) && !products.length) {
      if (anyTok(SHIFT_STATE) || qword) return ask('shift');
      if (anyTok(OPEN_W)) return ask('open_shift');
      if (anyTok(CLOSE_W)) return ask('howto', { faq: 'close_shift' });
    }
    // sections of the site
    const nav = NAV_TARGETS.find(([, re]) => anyTok(re));
    const onlyNav = nav && words.every(t => NAV_TARGETS.some(([, re]) => re.test(t.t) || (t.lat && re.test(t.lat))) || (t.kind === 'intent' && (t.intent === 'open' || t.intent === 'show')) || NAV_VERB.test(t.t) || MARKER.test(t.t)
      || /^(клиент|кардар|товаров|раздел|страниц|экран|бет$|бети|панел|баней|бани|баня|бане|управлени|контрол|кр$|код|qr)/.test(t.t));
    if (nav && (!qword || navVerb) && !(addVerb && products.length) && !(period === 'yesterday' && nav[0] === 'reportView')
      && (onlyNav || (navVerb && !qword && !roomsAll.length) || ((navVerb || onlyNav) && ['customers', 'qr', 'clean', 'menu', 'exit', 'daily', 'stats', 'ceo', 'manager'].includes(nav[0])))) {
      const bareAnswer = !navVerb && onlyNav && words.length === 1 && ((nav[0] === 'reportView' && !/^(отчет|отчёт|отчот)/.test(words[0].t)) || nav[0] === 'profit');
      if (!bareAnswer) return { type: 'nav', target: nav[0] };
    }
    // explicit commands win over questions
    if (addVerb && (products.length || items.length || questions.length)) return null;
    const plainList = anyTok(/^активн(ые|ых|ым|ыми)$/) || anyTok(/^свободн(ые|ых|ым|ыми)$/);
    if ((intents.has('activate') || intents.has('undo') || intents.has('deactivate') || intents.has('open')) && !qword && !plainList) return null;

    const info = qword || plainList || anyTok(SUMMARY) || anyTok(STOCK_W) || anyTok(PRICE_W) || anyTok(REVENUE_W) || anyTok(EXPENSE_W)
      || anyTok(PROFIT_W) || anyTok(BOOKING_W) || anyTok(SALES_W) || anyTok(FIND_W) || anyTok(BONUS_W) || anyTok(TIME_W) || anyTok(SHIFT_W)
      || (nav && (nav[0] === 'reportView' || nav[0] === 'profit')) || (words.length > 0 && words.every(t => CLIENT_W.test(t.t)));
    if (!info) return null;

    if (anyTok(SUMMARY) || two(/^как$/, /^(дела|делишки)$/) || two(/^что$/, /^(нового|новенького)$/)) return ask('summary');
    if ((anyTok(TIME_W) && anyTok(OVERTIME_W)) || toks.some(t => t.kind === 'duration' && t.value === 3)) return ask('overtime', { refs: [] });
    if (roomsAll.length && (anyTok(ROOM_INFO) || qword)) return ask('room');
    if ((anyTok(/^котор/) && anyTok(/^час/)) || (anyTok(/^саат/) && anyTok(/^канча/)) || (anyTok(/^времени$/) && anyTok(/^сколько$/))) return ask('time');
    if (anyTok(DATE_W) && (qword || anyTok(/^(сегодня|бугун)/))) return ask('date');
    if (anyTok(BOOKING_W)) return ask('bookings');
    if (anyTok(FIND_W) || anyTok(BONUS_W)) return ask('customer', { query: customerQuery(toks, heard) });
    if (anyTok(BASE_W) && anyTok(CLIENT_W)) return ask('customer_count');
    if (anyTok(EXPENSE_W)) return ask('expenses');
    if (anyTok(PROFIT_W)) return ask('profit');
    if (anyTok(REPORT_W) && period === 'yesterday') return ask('report');
    if (anyTok(SALES_W)) return ask('sales');
    // Kyrgyz «кола канча?» / «вход канча?» asks the price; «канча калды», «канча келди» count.
    const kyHowMuch = anyTok(/^(канча|канчадан)$/) && !anyTok(STOCK_W) && !anyTok(SALES_W) && !anyTok(/^(келди|кирди|болду|калды|калган|бар|барбы|адам|киши)$/);
    if ((anyTok(PRICE_W) || kyHowMuch) && (products.length || entries.length) && !roomsAll.length) return ask('price');
    if (anyTok(STOCK_W) || (products.length && (qword || anyTok(/^(есть|бар|барбы|жокпу)$/)))) {
      return ask('stock', { low: anyTok(LOW_W), out: anyTok(OUT_W) && !anyTok(LOW_W) });
    }
    if (anyTok(ENTRY_W) && (qword || anyTok(/^(входов|детей)$/))) return ask('entries');
    if (anyTok(FREE_W)) return ask('free');
    if (anyTok(REVENUE_W) || (nav && nav[0] === 'reportView')) return ask(period === 'today' ? 'revenue' : 'report');
    if (plainList || (anyTok(ACTIVE_W) && (anyTok(CLIENT_W) || anyTok(MARKER) || anyTok(/^актив/) || anyTok(/^(кто|ким|кимдер|сколько|канча)$/)))) return ask('active');
    if (anyTok(CLIENT_W)) return ask('clients');
    if (anyTok(SHIFT_W)) return ask('shift');
    if (qword && !products.length && !items.length) return ask('unknown_q');
    return null;
  }

  // Name or phone the user asked to find: words that are not keywords.
  function customerQuery(toks, heard) {
    const digits = String(heard || '').replace(/\D+/g, '');
    if (digits.length >= 4) return { phone: digits.slice(-9), text: '' };
    const KEY = [QWORD, FIND_W, BONUS_W, BASE_W, CLIENT_W, PERIODS[0][1], /^(номер|номери|номерин|телефону|телефонун|телефонду|покажи|скажи|айт|айтчы|дай|бер|у$|его|ее|её|анын|счет|счёт|баланс|сколько|канча|есть|бар|барбы|какой|какая|кайсы)$/];
    const terms = toks.filter(t => (t.kind === 'word' || t.kind === 'filler') && !FILLER.has(t.t) && !KEY.some(re => re.test(t.t)))
      .map(t => t.t.replace(/(нын|нин|нун|дын|дин|дун|тын|тин|тун|га|ге|ка|ке|ны|ни|ну|ды|ди|ду|ты|ти|ту|а|у|ы|е)$/, m => (t.t.length - m.length >= 3 ? '' : m)));
    return { phone: '', text: terms.join(' ').trim() };
  }

  // Closest catalogue names for words Jarvis did not understand (for the «Возможно, вы имели в виду» chips).
  function tokSimLoose(a, b) {
    const v = tokSim(a, b);
    if (v) return v;
    if (a.startsWith('sz_') || b.startsWith('sz_')) return 0;
    const pa = phon(a), pb = phon(b);
    const maxl = Math.max(pa.length, pb.length);
    if (maxl < 3) return 0;
    return Math.max(0, 1 - lev(pa, pb) / maxl);
  }
  function suggest(text, index, limit) {
    const toks = lex(text, index.vocab).filter(t => t.kind === 'word' || t.kind === 'size');
    if (!toks.length) return [];
    const spoken = phon(toks.map(t => t.t).join(''));
    const scored = [];
    for (const it of index.items) {
      let best = 0;
      for (const al of it.aliases) {
        let sum = 0;
        for (const t of toks) { let b = 0; for (const c of al.c) b = Math.max(b, tokSimLoose(t.c, c)); sum += b; }
        const target = phon(al.raw.filter(r => !r.startsWith('sz_')).join(''));
        const whole = target && spoken ? 1 - lev(spoken, target) / Math.max(spoken.length, target.length) : 0;
        best = Math.max(best, sum / toks.length, whole * 0.9);
      }
      if (best >= 0.55) scored.push({ ref: it.ref, score: best });
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored.length ? scored[0].score : 0;
    return scored.filter(x => x.score >= top * 0.82).slice(0, limit || 4).map(x => x.ref);
  }

  /* =====================================================================
     СУММЫ ГОЛОСОМ — коротко, как говорит кассир:
       2345 → «две триста сорок пять», 1200 → «тысяча двести», 2050 → «две тысячи пятьдесят»,
       24 350 → «двадцать четыре триста пятьдесят» (или «двадцать четыре тысячи» с округлением),
       169 400 → «сто шестьдесят девять тысяч». Цифры словами: телефон не читает их по одной.
     ===================================================================== */
  const ruPlural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };
  const W_ONE_M = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const W_ONE_F = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const W_TEEN = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
  const W_TEN = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
  const W_HUND = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
  function words3(n, fem) {
    const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, o = n % 10, out = [];
    if (h) out.push(W_HUND[h]);
    if (t === 1) out.push(W_TEEN[o]);
    else { if (t) out.push(W_TEN[t]); if (o) out.push((fem ? W_ONE_F : W_ONE_M)[o]); }
    return out.join(' ');
  }
  const thousandsWords = k => (k === 1 ? 'тысяча' : `${words3(k, true)} ${ruPlural(k, 'тысяча', 'тысячи', 'тысяч')}`);
  // round: суммы от 10 000 — до тысяч («двадцать четыре тысячи»). От 100 000 — всегда до тысяч.
  function amountWords(value, round) {
    const num = Number(value) || 0;
    let v = Math.round(Math.abs(num));
    if (v >= 100000 || (round && v >= 10000)) v = Math.round(v / 1000) * 1000;
    let text;
    if (v === 0) text = 'ноль';
    else if (v < 1000) text = words3(v, false);
    else if (v >= 1000000) {
      const m = Math.floor(v / 1000000), k = Math.floor((v % 1000000) / 1000);
      text = `${m === 1 ? 'миллион' : `${words3(m % 1000, false)} ${ruPlural(m, 'миллион', 'миллиона', 'миллионов')}`}${k ? ' ' + thousandsWords(k) : ''}`;
    } else {
      const k = Math.floor(v / 1000), r = v % 1000;
      text = !r ? thousandsWords(k) : r < 100 ? `${thousandsWords(k)} ${words3(r, false)}` : `${k === 1 ? 'тысяча' : words3(k, true)} ${words3(r, false)}`;
    }
    return (num < 0 && v ? 'минус ' : '') + text;
  }

  const Core = { VERSION, norm, lex, parse, buildIndex, suggest, tokSim, phon, canon, sayName, productTokenLists, latinVariants, matchSpans, spanCandidates, judge, amountWords };

  if (typeof module === 'object' && module && module.exports) { module.exports = Core; return; }

  /* =====================================================================
     БРАУЗЕР: микрофон, панель «Джарвис», выполнение команд через функции приложения.
     ===================================================================== */
  if (typeof window === 'undefined' || window.PARORDOJarvis) return;

  const STORE = 'parordo_jarvis_v1';
  const ALIAS_STORE = 'parordo_jarvis_aliases_v1';
  const CTX_TTL = 3 * 60 * 1000;
  const MAX_ROWS = 8;
  const LANGS = [['ru-RU', 'Русский'], ['ky-KG', 'Кыргызча'], ['kk-KZ', 'Казахский']];

  const readJSON = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v && typeof v === 'object' ? v : fallback; } catch (_) { return fallback; } };
  const writeJSON = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  const settings = Object.assign({ lang: 'ru-RU', voice: true, autoListen: false, hintShown: false, greet: true, address: 'sir',
    voiceName: '', pitch: 0.85, rate: 1.1, serverVoiceOn: true, serverVoice: 'ru-RU-Chirp3-HD-Charon', roundTotals: true,
    alertRooms: true, alertStock: true }, readJSON(STORE, {}));
  if (!['sir', 'madam', 'none'].includes(settings.address)) settings.address = 'sir';
  if (!LANGS.some(([code]) => code === settings.lang)) settings.lang = 'ru-RU';
  let learned = readJSON(ALIAS_STORE, {});
  const saveSettings = () => writeJSON(STORE, settings);
  const saveLearned = () => writeJSON(ALIAS_STORE, learned);

  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const appDb = () => (typeof db !== 'undefined' ? db : null);
  const role = () => { try { return currentRole(); } catch (_) { return ''; } };
  const shift = () => { try { return shiftState; } catch (_) { return { loaded: false, isOpen: false }; } };
  const clientOf = n => { try { return clientForRoom(n); } catch (_) { return null; } };
  const clientNo = c => { try { return shiftClientNo(c); } catch (_) { return c && c.clientNo; } };
  const money = v => `${Number(v || 0).toLocaleString('ru-RU')} сом`;
  const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };

  /* ---------- каталог ---------- */
  let indexCache = { sig: '', index: null };
  function getIndex() {
    const d = appDb();
    const list = d && Array.isArray(d.products) ? d.products : [];
    const sig = list.map(p => `${p.id}:${p.name}:${p.price}`).join('|') + '#' + JSON.stringify(learned);
    if (sig !== indexCache.sig || !indexCache.index) indexCache = { sig, index: Core.buildIndex(list, learned) };
    return indexCache.index;
  }
  async function ensureProducts() {
    const d = appDb();
    if (d && Array.isArray(d.products) && d.products.length) return;
    try { if (typeof window.loadProducts === 'function') await window.loadProducts(); } catch (_) {}
  }
  const itemOf = ref => getIndex().byRef.get(ref) || null;
  const productOf = it => { const d = appDb(); return it && it.kind === 'product' && d ? (d.products || []).find(p => Number(p.id) === Number(it.id)) || null : null; };

  /* ---------- вход: цена как у кнопок «Вход» (customer-features V118) ---------- */
  let pricing = { active: false, at: 0 };
  function bishkekMinutes() {
    try {
      const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bishkek', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).split(':').map(Number);
      return h * 60 + m;
    } catch (_) { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  }
  async function entryPrices() {
    if (Date.now() - pricing.at > 30000) {
      try { const r = await window.api('/api/admin/control/entry-pricing'); pricing = { active: !!(r && r.active === true), at: Date.now() }; }
      catch (_) { pricing.at = Date.now(); }
    }
    const mins = bishkekMinutes();
    return pricing.active && mins >= 600 && mins < 900 ? { adult: 200, child: 150 } : { adult: 300, child: 200 };
  }

  /* ---------- тихий вызов функций приложения ---------- */
  // addPurchase/activateRoom/changeQty открывают окна и показывают тосты. Во время голосовой команды
  // окно клиента не открываем, а сообщения забираем в панель Джарвиса.
  const silent = { depth: 0, captured: [], expectClient: false };
  const SILENT_RE = /^(Добавлено|Покупка добавлена|Товар не найден|Подождите|Клиент не сохранён|Браслет №3|Внимание: проверьте|Недостаточно|«.+» закончился|Позиция удалена|Количество обновлено|Не удалось сохранить количество|Не удалось подтвердить резерв|№\d+ · Клиент|Не удалось выдать браслет|Проверяем статус смены|Смена закрыта|Позиция оплачена бонусом)/;
  function wrapGlobal(name, make) {
    const original = window[name];
    if (typeof original !== 'function' || original.__poJv) return;
    const wrapped = make(original);
    wrapped.__poJv = true;
    window[name] = wrapped;
  }
  function installWrappers() {
    wrapGlobal('toast', original => function (message) {
      if (silent.depth > 0 && SILENT_RE.test(String(message || ''))) { silent.captured.push(String(message)); return undefined; }
      return original.apply(this, arguments);
    });
    wrapGlobal('closeModal', original => function (sel) {
      if (silent.depth > 0 && sel === '#addModal') {
        silent.expectClient = true;
        Promise.resolve().then(() => { silent.expectClient = false; });
        return undefined;
      }
      return original.apply(this, arguments);
    });
    wrapGlobal('openModal', original => function (sel) {
      if (silent.depth > 0 && sel === '#clientModal' && silent.expectClient) { silent.expectClient = false; return undefined; }
      return original.apply(this, arguments);
    });
  }
  async function callSilently(clientId, fn) {
    const hasCurrent = typeof currentClientId !== 'undefined';
    const previous = hasCurrent ? currentClientId : null;
    const mark = silent.captured.length;
    silent.depth += 1;
    let pending;
    try {
      if (clientId != null && hasCurrent) currentClientId = clientId;
      pending = fn();
    } catch (e) {
      silent.depth -= 1;
      throw e;
    } finally {
      if (clientId != null && hasCurrent) currentClientId = previous;
    }
    try { await pending; } finally { silent.depth -= 1; }
    return silent.captured.splice(mark);
  }
  function withConfirmYes(fn) {
    const original = window.confirm;
    window.confirm = () => true;
    try { return fn(); } finally { window.confirm = original; }
  }
  const snapshot = c => new Map((c.items || []).map(i => [String(i.id), Number(i.qty || 0)]));
  const freshClient = c => { const d = appDb(); return (d && (d.clients || []).find(x => String(x.id) === String(c.id))) || c; };

  /* ---------- состояние ---------- */
  let ctx = { room: null, at: 0 };
  const history = [];          // undo records of this device
  const queue = [];
  let pumping = false;
  let pending = null;          // open question in the panel
  const pendingQueue = [];
  let sheetOpen = false;
  let recState = 'idle';       // idle | listening | busy
  let rec = null;
  let rowSeq = 0;
  const rows = [];

  const ctxRoom = () => (ctx.room && Date.now() - ctx.at < CTX_TTL ? ctx.room : null);
  function setCtx(room) { ctx = { room, at: Date.now() }; renderCtx(); }
  function clearCtx() { ctx = { room: null, at: 0 }; renderCtx(); }

  /* ---------- очередь (команды выполняются по порядку, панель не ждёт) ---------- */
  function newBatch(heard) { return { heard, jobs: 0, done: 0, say: [], closed: false, finished: false }; }
  function enqueue(batch, fn) {
    batch.jobs += 1;
    queue.push(async () => {
      try { await fn(batch); }
      catch (e) { addRow({ state: 'err', title: 'Ошибка', meta: String(e && e.message || e) }); }
      finally { batch.done += 1; finishBatch(batch); }
    });
    pump();
  }
  function closeBatch(batch) { batch.closed = true; finishBatch(batch); }
  function finishBatch(batch) {
    if (batch.finished || !batch.closed || batch.done < batch.jobs) return;
    batch.finished = true;
    const text = batch.say.filter(Boolean).join('. ');
    if (text) speak(text); else maybeAutoListen();
  }
  async function pump() {
    if (pumping) return;
    pumping = true;
    try { while (queue.length) await queue.shift()(); }
    finally { pumping = false; }
  }

  /* ---------- выполнение ---------- */
  function validRoom(n) { return Number.isInteger(n) && n >= 1 && n <= 36; }

  async function doActivate(n, batch) {
    if (!validRoom(n)) { addRow({ state: 'err', title: `Браслета №${n} нет`, meta: 'Номера браслетов: 1–36' }); batch.say.push(`Браслета ${n} нет`); return false; }
    if (!shift().loaded) { try { if (typeof window.syncShiftState === 'function') await window.syncShiftState(); } catch (_) {} }
    if (!shift().isOpen) { addRow({ state: 'err', title: 'Смена закрыта', meta: 'Сначала нажмите «Открыть смену»' }); batch.say.push('Смена закрыта'); return false; }
    const existing = clientOf(n);
    if (existing) {
      setCtx(n);
      addRow({ state: 'info', title: `№${n} уже активен`, meta: `Клиент ${clientNo(existing)} · ${existing.items.length ? existing.items.length + ' поз.' : 'без покупок'}` });
      batch.say.push(`Браслет ${n} уже активен`);
      return true;
    }
    const row = addRow({ state: 'wait', title: `Браслет №${n}`, meta: 'Активирую…' });
    const messages = await callSilently(null, () => window.activateRoom(n));
    const c = clientOf(n);
    if (c) {
      setCtx(n);
      updateRow(row, { state: 'ok', title: `Браслет №${n} активирован`, meta: `Клиент ${clientNo(c)}` });
      flash(n);
      batch.say.push(`Браслет ${n} активирован`);
      return true;
    }
    updateRow(row, { state: 'err', title: `№${n} не активирован`, meta: messages.find(m => /Не удалось|Смена/.test(m)) || 'Проверьте интернет и попробуйте ещё раз' });
    batch.say.push(`Браслет ${n} не активирован`);
    return false;
  }

  async function addUnit(c, it, prices) {
    // addPurchase changes this very object in place (and restores it on failure).
    const target = freshClient(c);
    const before = snapshot(target);
    let payload;
    if (it.kind === 'entry') payload = { name: it.entry === 'child' ? 'Вход детский' : 'Вход', price: it.entry === 'child' ? prices.child : prices.adult, productId: null };
    else {
      const p = productOf(it);
      if (!p) return { ok: false, reason: 'Товар не найден в каталоге' };
      const price = p.price == null ? NaN : Number(p.price);
      if (!Number.isInteger(price) || price < 0) return { ok: false, reason: 'У товара нет цены — укажите цену в «Товары»' };
      payload = { name: p.name, price, productId: Number(p.id) };
    }
    const messages = await callSilently(target.id, () => window.addPurchase(payload));
    const changed = (target.items || []).find(i => {
      const was = before.get(String(i.id));
      const grew = was == null ? true : Number(i.qty || 0) > was;
      if (!grew) return false;
      return it.kind === 'entry' ? i.productId == null && i.name === payload.name : Number(i.productId) === Number(payload.productId);
    });
    if (changed) return { ok: true, itemId: String(changed.id), price: Number(changed.price), messages };
    const reason = messages.find(m => !/^Добавлено|^Покупка добавлена/.test(m)) || 'Не сохранено — проверьте интернет';
    return { ok: false, reason: reason.replace(/^Клиент не сохранён на сервере: /, '') };
  }

  async function doAdd(room, items, batch) {
    if (!validRoom(room)) { addRow({ state: 'err', title: `Браслета №${room} нет`, meta: 'Номера браслетов: 1–36' }); batch.say.push(`Браслета ${room} нет`); return; }
    const c = clientOf(room);
    if (!c) {
      if (!shift().isOpen) { addRow({ state: 'err', title: 'Смена закрыта', meta: 'Сначала нажмите «Открыть смену»' }); batch.say.push('Смена закрыта'); return; }
      askPending({ kind: 'inactive', room, items });
      batch.say.push(`Браслет ${room} не активен. Активировать?`);
      return;
    }
    setCtx(room);
    const prices = items.some(it => itemOf(it.ref) && itemOf(it.ref).kind === 'entry') ? await entryPrices() : null;
    const spoken = [], warnings = [];
    for (const it of items) {
      const entry = itemOf(it.ref);
      if (!entry) continue;
      const qty = Math.max(1, Math.min(50, Number(it.qty) || 1));
      const label = entry.kind === 'entry' ? entry.name : entry.name + (entry.tag ? ` · ${entry.tag}` : '');
      const row = addRow({ state: 'wait', title: `${label}${qty > 1 ? ' ×' + qty : ''}`, meta: `№${room} · Клиент ${clientNo(c)} · сохраняю…` });
      const record = { type: 'add', clientId: String(c.id), room, ref: entry.ref, label, units: [] };
      let added = 0, price = 0, reason = '';
      for (let u = 0; u < qty; u++) {
        const res = await addUnit(freshClient(c), entry, prices);
        if (!res.ok) { reason = res.reason; break; }
        added += 1; price = res.price; record.units.push(res.itemId);
      }
      if (added) {
        history.push(record);
        if (history.length > 30) history.shift();
        const p = productOf(entry);
        const stock = p ? ` · остаток ${Math.max(0, Number(p.available ?? (Number(p.stock || 0) - Number(p.reserved || 0))))}` : '';
        const state = added < qty ? 'warn' : 'ok';
        updateRow(row, { state, title: `${label} ×${added}${added < qty ? ' из ' + qty : ''}`, meta: `№${room} · ${money(price * added)}${stock}${reason ? ' · ' + reason : ''}`, undo: record });
        spoken.push(entry.say + (added > 1 ? `, ${added}` : ''));
        if (added < qty) warnings.push(`${entry.say}: добавлено ${added} из ${qty}`);
        flash(room);
      } else {
        updateRow(row, { state: 'err', title: `${label} — не добавлено`, meta: `№${room} · ${reason}` });
        warnings.push(`${entry.say} не добавлен`);
      }
    }
    if (spoken.length) batch.say.push(`Браслет ${room}: ${spoken.join(', ')}`);
    batch.say.push(...warnings);
  }

  async function removeUnits(c, itemIds) {
    let removed = 0;
    for (const [id, count] of itemIds) {
      const now = freshClient(c);
      const item = (now.items || []).find(i => String(i.id) === String(id));
      if (!item) continue;
      const before = Number(item.qty || 0);
      const n = Math.min(count, before);
      await callSilently(now.id, () => withConfirmYes(() => window.changeQty(String(id), -n)));
      const after = (freshClient(c).items || []).find(i => String(i.id) === String(id));
      removed += before - (after ? Number(after.qty || 0) : 0);
    }
    return removed;
  }

  async function undoRecord(record, batch) {
    const idx = history.indexOf(record);
    if (idx >= 0) history.splice(idx, 1);
    const d = appDb();
    const c = d && (d.clients || []).find(x => String(x.id) === record.clientId && x.status === 'active');
    if (!c) { addRow({ state: 'err', title: 'Нельзя отменить', meta: 'Клиент уже завершён' }); batch && batch.say.push('Нельзя отменить'); return; }
    const counts = new Map();
    record.units.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
    const row = addRow({ state: 'wait', title: `Отмена: ${record.label}`, meta: `№${record.room} · убираю…` });
    const removed = await removeUnits(c, counts);
    if (removed) {
      updateRow(row, { state: 'ok', title: `Отменено: ${record.label}${removed > 1 ? ' ×' + removed : ''}`, meta: `№${record.room}` });
      rows.forEach(r => { if (r.undo === record) { r.undo = null; r.undone = true; } });
      renderRows();
      batch && batch.say.push('Отменено');
    } else {
      updateRow(row, { state: 'err', title: `Не удалось отменить: ${record.label}`, meta: 'Позиция уже оплачена или изменена — уберите вручную' });
      batch && batch.say.push('Не удалось отменить');
    }
  }

  async function doRemove(room, items, batch) {
    const c = clientOf(room);
    if (!c) { addRow({ state: 'err', title: `№${room} не активен`, meta: 'Нечего убирать' }); batch.say.push(`Браслет ${room} не активен`); return; }
    setCtx(room);
    for (const it of items) {
      const entry = itemOf(it.ref);
      if (!entry) continue;
      const match = i => (entry.kind === 'entry' ? i.productId == null && i.name === (entry.entry === 'child' ? 'Вход детский' : 'Вход') : Number(i.productId) === Number(entry.id));
      const lines = (c.items || []).filter(i => match(i) && i.method === 'pending').slice().reverse();
      if (!lines.length) {
        const paid = (c.items || []).some(match);
        addRow({ state: 'err', title: `${entry.name} — нечего убрать`, meta: `№${room} · ${paid ? 'позиция уже оплачена, уберите вручную' : 'в чеке нет'}` });
        batch.say.push(`${entry.say}: нечего убрать`);
        continue;
      }
      let left = Math.max(1, Number(it.qty) || 1);
      const counts = new Map();
      for (const line of lines) { if (!left) break; const n = Math.min(left, Number(line.qty || 0)); counts.set(String(line.id), n); left -= n; }
      const row = addRow({ state: 'wait', title: `Убираю: ${entry.name}`, meta: `№${room}` });
      const removed = await removeUnits(c, counts);
      updateRow(row, removed ? { state: 'ok', title: `Убрано: ${entry.name}${removed > 1 ? ' ×' + removed : ''}`, meta: `№${room}` }
        : { state: 'err', title: `Не удалось убрать: ${entry.name}`, meta: `№${room}` });
      batch.say.push(removed ? `Убрано: ${entry.say}` : `Не удалось убрать ${entry.say}`);
    }
  }

  function doOpen(n, batch, note) {
    const c = clientOf(n);
    if (!c) return false;
    setCtx(n);
    closeSheet();
    try { window.openClient(c.id); } catch (_) {}
    if (note) try { window.toast(note, 4200); } catch (_) {}
    batch && batch.say.push(`Браслет ${n}`);
    return true;
  }

  function execute(r) {
    if (pending && answerPending(r)) return;
    // A new command replaces an unanswered question: the old one is no longer relevant.
    if (pending && (r.actions.length || r.questions.length)) { pending = null; pendingQueue.length = 0; renderAsk(); }
    const batch = newBatch(r.heard);
    if (!r.actions.length && !r.questions.length) {
      if (r.neg) { setStatus('Хорошо, ничего не делаю.'); closeBatch(batch); return; }
      const sug = r.unknown.length ? Core.suggest(r.unknown.join(' '), getIndex(), 4) : [];
      if (sug.length) askPending({ kind: 'product', text: r.unknown.join(' '), phrase: r.unknownPhrase, qty: 1, room: null, options: sug, guess: true });
      else addRow({ state: 'warn', title: 'Не понял команду', meta: r.heard ? `«${r.heard}»` : 'Повторите громче и ближе к телефону' });
      batch.say.push(sug.length ? 'Не понял. Выберите товар' : 'Не понял');
      closeBatch(batch);
      return;
    }
    const WRITE = new Set(['activate', 'add', 'remove', 'undo']);
    for (const a of r.actions) {
      if (a.type === 'nav') { enqueue(batch, b => doNav(a.target, b)); continue; }
      if (a.type === 'ask') { enqueue(batch, b => doAsk(a, b)); continue; }
      if (!canWrite() && (WRITE.has(a.type) || (a.type === 'open' && a.rooms.some(n => !clientOf(n))))) {
        const rr = readonlyResult(); addRow({ kind: 'card', card: rr.card, state: 'warn' }); batch.say.push(rr.say); continue;
      }
      if (a.type === 'activate') {
        if (!a.rooms.length) askPending({ kind: 'activateRoom' });
        a.rooms.forEach(n => enqueue(batch, b => doActivate(n, b)));
      } else if (a.type === 'open') {
        a.rooms.forEach(n => enqueue(batch, async b => { if (!doOpen(n, b)) await doActivate(n, b); }));
        if (!a.rooms.length) askPending({ kind: 'activateRoom' });
      } else if (a.type === 'show' || a.type === 'deactivate') {
        const rooms = a.rooms.length ? a.rooms : (ctxRoom() ? [ctxRoom()] : []);
        if (!rooms.length) addRow({ state: 'warn', title: 'Какой браслет?', meta: 'Скажите номер, например «покажи 5»' });
        rooms.forEach(n => enqueue(batch, async b => {
          const note = a.type === 'deactivate' ? 'Чтобы освободить браслет: отметьте оплату и нажмите «Завершить клиента».' : '';
          if (!doOpen(n, b, note)) { addRow({ state: 'info', title: `№${n} свободен`, meta: 'Клиента на браслете нет' }); b.say.push(`Браслет ${n} свободен`); }
        }));
      } else if (a.type === 'add' || a.type === 'remove') {
        const room = a.room != null ? a.room : ctxRoom();
        const big = a.type === 'add' ? a.items.filter(it => it.qty > 10) : [];
        if (room == null) { askPending({ kind: 'room', items: a.items, remove: a.type === 'remove' }); batch.say.push('На какой браслет?'); continue; }
        if (big.length) { askPending({ kind: 'confirmQty', room, items: a.items }); batch.say.push(`Добавить ${big[0].qty}?`); continue; }
        enqueue(batch, b => (a.type === 'add' ? doAdd(room, a.items, b) : doRemove(room, a.items, b)));
      } else if (a.type === 'undo') {
        enqueue(batch, async b => {
          const last = history[history.length - 1];
          if (!last) { addRow({ state: 'info', title: 'Нечего отменять', meta: 'Отменяются только команды Джарвиса на этом телефоне' }); b.say.push('Нечего отменять'); return; }
          await undoRecord(last, b);
        });
      } else if (a.type === 'select') {
        const n = a.rooms[0];
        if (!validRoom(n)) { addRow({ state: 'err', title: `Браслета №${n} нет`, meta: 'Номера браслетов: 1–36' }); continue; }
        setCtx(n);
        const c = clientOf(n);
        addRow({ state: 'info', title: `Выбран браслет №${n}`, meta: c ? `Клиент ${clientNo(c)} · говорите товары` : 'Свободен — скажите «активный кыл»' });
        batch.say.push(`Браслет ${n}`);
      }
    }
    if (r.questions.length && !canWrite()) { const rr = readonlyResult(); addRow({ kind: 'card', card: rr.card, state: 'warn' }); batch.say.push(rr.say); closeBatch(batch); return; }
    r.questions.forEach(q => askPending({ kind: 'product', text: q.text, phrase: q.phrase, qty: q.qty, room: q.room, options: q.options, remove: q.remove }));
    if (r.questions.length && !r.actions.length) batch.say.push('Уточните, какой именно');
    if (r.unknown.length && r.actions.length) addRow({ state: 'warn', title: 'Часть не понял', meta: `«${r.unknown.join(' ')}» — повторите отдельно` });
    closeBatch(batch);
  }

  /* ---------- уточняющие вопросы ---------- */
  function askPending(p) {
    if (p.kind === 'product' && p.remember == null) p.remember = !!p.guess;
    if (pending) { pendingQueue.push(p); return; }
    pending = p;
    renderAsk();
  }
  function nextPending() {
    pending = pendingQueue.shift() || null;
    renderAsk();
  }
  function learn(phrase, ref) {
    const key = String(phrase || '').trim().toLowerCase();
    if (!key || key.length > 40 || /\d/.test(key)) return;
    learned[key] = ref;
    saveLearned();
    indexCache.sig = '';
  }
  // Sizes of one product (Трусы S/M/L…, Шампунь CLEAR S/M) are never learned: the size changes every time.
  const baseName = ref => { const it = itemOf(ref); return it ? String(it.name).replace(/\s*[—–-]\s*размер\s+\S+$/i, '').replace(/\s*\|\s*\S+$/, '').trim().toLowerCase() : ref; };
  const willLearn = p => !!p && (p.guess || new Set(p.options.map(baseName)).size > 1);
  function resolveProduct(ref) {
    const p = pending;
    if (!p) return;
    if (willLearn(p) && p.remember) learn(p.phrase, ref);
    const item = { ref, qty: p.qty || 1 };
    nextPending();
    const batch = newBatch('');
    const room = p.room != null ? p.room : ctxRoom();
    if (room == null) askPending({ kind: 'room', items: [item], remove: p.remove });
    else enqueue(batch, b => (p.remove ? doRemove(room, [item], b) : doAdd(room, [item], b)));
    closeBatch(batch);
  }
  function resolveRoom(n) {
    const p = pending;
    if (!p) return;
    nextPending();
    const batch = newBatch('');
    if (p.kind === 'activateRoom') enqueue(batch, b => doActivate(n, b));
    else if (p.kind === 'room') enqueue(batch, b => (p.remove ? doRemove(n, p.items, b) : doAdd(n, p.items, b)));
    closeBatch(batch);
  }
  function resolveYes() {
    const p = pending;
    if (!p) return;
    nextPending();
    const batch = newBatch('');
    if (p.kind === 'inactive') enqueue(batch, async b => { if (await doActivate(p.room, b)) await doAdd(p.room, p.items, b); });
    else if (p.kind === 'openShift') enqueue(batch, async b => {
      const row = addRow({ state: 'wait', title: 'Открываю смену…', meta: '' });
      try { await window.openShift(); } catch (_) {}
      if (shift().isOpen) { updateRow(row, { state: 'ok', title: 'Смена открыта', meta: `с ${hm(shift().openedAt)}` }); b.say.push('Смена открыта. Удачной работы'); }
      else { updateRow(row, { state: 'err', title: 'Смена не открыта', meta: 'Проверьте интернет и попробуйте ещё раз' }); b.say.push('Не удалось открыть смену'); }
    });
    else if (p.kind === 'confirmQty') enqueue(batch, b => doAdd(p.room, p.items, b));
    closeBatch(batch);
  }
  function cancelPending() {
    if (!pending) return;
    nextPending();
    setStatus('Отменено.');
  }
  // Voice answer to an open question. Returns true when the phrase was the answer.
  function answerPending(r) {
    const p = pending;
    if (r.neg) { cancelPending(); speak('Хорошо'); return true; }
    if ((p.kind === 'inactive' || p.kind === 'confirmQty' || p.kind === 'openShift') && r.yes) { resolveYes(); return true; }
    const rooms = r.actions.filter(a => a.type === 'select').flatMap(a => a.rooms);
    if ((p.kind === 'room' || p.kind === 'activateRoom') && rooms.length && !r.actions.some(a => a.items)) { resolveRoom(rooms[0]); return true; }
    if (p.kind === 'product') {
      const refs = r.actions.flatMap(a => a.items || []).map(it => it.ref).concat(r.questions.flatMap(q => q.options.length === 1 ? q.options : []));
      const hit = refs.find(ref => p.options.includes(ref));
      if (hit && r.actions.length <= 1) { resolveProduct(hit); return true; }
      // «эм», «эль», «икс эль», «2XL»: a size picks among the shown options
      const sizeTok = r.tokens.find(t => t.kind === 'size') || Core.lex('размер ' + r.heard, getIndex().vocab).find(t => t.kind === 'size');
      if (sizeTok) {
        const opts = p.options.filter(ref => { const it = itemOf(ref); return it && it.aliases.some(al => al.c.includes(sizeTok.c)); });
        if (opts.length === 1) { resolveProduct(opts[0]); return true; }
      }
      const ord = r.tokens.find(t => t.kind === 'num' && t.ord);
      if (ord && ord.value >= 1 && ord.value <= p.options.length && r.tokens.every(t => t.kind !== 'word')) { resolveProduct(p.options[ord.value - 1]); return true; }
    }
    // Anything else is a new command: the question stays on screen.
    return false;
  }

  /* ---------- голос ---------- */
  // 1) Голос сервера (Worker V10.20 → Google Cloud Text-to-Speech): живой мужской голос, одинаковый на всех телефонах.
  // 2) Голос телефона: мужской русский голос, если он есть в списке, тон чуть ниже. Если сервер не отвечает — тоже он.
  const SERVER_VOICES = [
    ['ru-RU-Chirp3-HD-Charon', 'Charon', 'спокойный, деловой'],
    ['ru-RU-Chirp3-HD-Algieba', 'Algieba', 'мягкий, бархатный'],
    ['ru-RU-Chirp3-HD-Schedar', 'Schedar', 'ровный, сдержанный'],
    ['ru-RU-Chirp3-HD-Orus', 'Orus', 'твёрдый, уверенный'],
    ['ru-RU-Chirp3-HD-Iapetus', 'Iapetus', 'чёткий, ясный'],
    ['ru-RU-Chirp3-HD-Algenib', 'Algenib', 'низкий, с хрипотцой']
  ];
  if (!SERVER_VOICES.some(v => v[0] === settings.serverVoice)) settings.serverVoice = SERVER_VOICES[0][0];
  const clampNum = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  const rateOf = () => Math.round(clampNum(settings.rate, 0.8, 1.5, 1.1) * 100) / 100;
  const pitchOf = () => Math.round(clampNum(settings.pitch, 0.5, 1.3, 0.85) * 100) / 100;
  const MALE_VOICE = /(male|мужск|pavel|павел|dmitr|дмитр|yuri|юрий|maxim|максим|artem|артём|артем|filipp|филипп)/i;
  const FEMALE_VOICE = /(female|женск|milena|милена|irina|ирина|svetlana|светлана|katya|катя|alyona|алёна|alena|dari|дари|ekaterina|екатерина|anna|анна)/i;
  let ruVoices = [];
  function loadVoices() {
    try { ruVoices = (window.speechSynthesis.getVoices() || []).filter(v => /^ru(-|_|$)/i.test(String(v.lang || ''))); } catch (_) { ruVoices = []; }
    return ruVoices;
  }
  const isMaleVoice = v => MALE_VOICE.test(v.name) && !FEMALE_VOICE.test(v.name);
  function deviceVoice() {
    if (!ruVoices.length) loadVoices();
    if (settings.voiceName) { const chosen = ruVoices.find(v => v.name === settings.voiceName); if (chosen) return chosen; }
    return ruVoices.find(isMaleVoice) || ruVoices.find(v => v.default) || ruVoices[0] || null;
  }

  let speechSeq = 0, speakingNow = false;
  function finishSpeech(done) {
    speakingNow = false;
    (done || maybeAutoListen)();
    setTimeout(flushAlerts, 600);
  }
  function stopDevice() { try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (_) {} }
  let audioCtx = null, audioSrc = null;
  function stopAudio() {
    const src = audioSrc;
    audioSrc = null;
    if (src) try { src.stop(0); } catch (_) {}
  }
  function cancelSpeech() { speechSeq += 1; speakingNow = false; stopDevice(); stopAudio(); }
  function deviceSpeak(text, done) {
    const seq = speechSeq;
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') { finishSpeech(done); return; }
    try {
      stopDevice();
      const u = new window.SpeechSynthesisUtterance(text);
      u.lang = 'ru-RU';
      u.rate = rateOf();
      u.pitch = pitchOf();
      const v = deviceVoice();
      if (v) u.voice = v;
      const end = () => { if (seq === speechSeq) finishSpeech(done); };
      u.onend = end;
      u.onerror = end;
      speakingNow = true;
      window.speechSynthesis.speak(u);
    } catch (_) { finishSpeech(done); }
  }

  /* ---------- возможности сервера: /api/health → features ---------- */
  const serverFeatures = new Set();
  let featuresAt = 0, featuresVersion = '';
  async function refreshFeatures(force) {
    if (!force && Date.now() - featuresAt < 10 * 60e3) return serverFeatures;
    featuresAt = Date.now();
    try {
      const h = await window.api('/api/health');
      serverFeatures.clear();
      (Array.isArray(h && h.features) ? h.features : []).forEach(f => serverFeatures.add(String(f)));
      featuresVersion = String(h && h.version || '');
    } catch (_) { /* нет связи: оставляем прошлый список */ }
    return serverFeatures;
  }
  const serverHas = name => serverFeatures.has(name);

  /* ---------- голос сервера ---------- */
  function ensureAudioCtx() {
    if (audioCtx) return audioCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { audioCtx = new AC(); } catch (_) { audioCtx = null; }
    return audioCtx;
  }
  // Телефоны разрешают звук только после касания экрана: первое касание «включает» звук Джарвиса.
  function unlockAudio() {
    const c = ensureAudioCtx();
    if (c && c.state === 'suspended') { try { const p = c.resume(); if (p && p.catch) p.catch(() => {}); } catch (_) {} }
  }
  const TTS_CACHE = 'po-jarvis-voice-v1';
  const ttsMem = new Map();
  let serverBrokenUntil = 0, serverError = '', serverErrorShown = false;
  function ttsKey(text) {
    let h1 = 0x811c9dc5, h2 = 0x9e3779b9 ^ text.length;
    for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519) ^ (h2 >>> 15); }
    return `${settings.serverVoice}/${rateOf()}/${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}${text.length}`;
  }
  async function ttsBytes(text, key) {
    const url = 'https://po-jarvis.voice/' + encodeURIComponent(key);
    let cache = null;
    try {
      cache = 'caches' in window ? await window.caches.open(TTS_CACHE) : null;
      const hit = cache && await cache.match(url);
      if (hit) return await hit.arrayBuffer();
    } catch (_) { cache = null; }
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => { try { if (ctrl) ctrl.abort(); } catch (_) {} }, 4500);   // медленная сеть — сразу голос телефона
    let r;
    try {
      r = await window.api('/api/admin/jarvis/tts', { method: 'POST', body: JSON.stringify({ text, voice: settings.serverVoice, rate: rateOf() }), signal: ctrl ? ctrl.signal : undefined });
    } finally { clearTimeout(timer); }
    if (!r || !r.audio) throw new Error('сервер не вернул звук');
    const bin = atob(String(r.audio));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    try { if (cache) await cache.put(url, new Response(bytes.slice(0), { headers: { 'Content-Type': 'audio/mpeg' } })); } catch (_) {}
    return bytes.buffer;
  }
  function decodeAudio(c, bytes) {
    return new Promise((resolve, reject) => {
      try { const p = c.decodeAudioData(bytes, resolve, reject); if (p && typeof p.then === 'function') p.then(resolve, reject); }
      catch (e) { reject(e); }
    });
  }
  function serverFailed(e) {
    serverBrokenUntil = Date.now() + 5 * 60e3;
    serverError = String(e && e.message || e || 'нет связи').slice(0, 160);
    if (sheetOpen && !serverErrorShown) {
      serverErrorShown = true;
      addRow({ state: 'warn', title: 'Голос Джарвиса временно недоступен', meta: `${serverError}. Пока говорю голосом телефона.` });
    }
  }
  // true — фраза озвучена (или уже не нужна), false — нужен голос телефона.
  async function serverSpeak(text, done, seq) {
    const c = ensureAudioCtx();
    if (!c) return false;
    const key = ttsKey(text);
    let buf = ttsMem.get(key);
    try {
      if (!buf) {
        buf = await decodeAudio(c, await ttsBytes(text, key));
        ttsMem.set(key, buf);
        if (ttsMem.size > 60) ttsMem.delete(ttsMem.keys().next().value);
      }
    } catch (e) {
      if (seq !== speechSeq) return true;
      serverFailed(e);
      return false;
    }
    if (seq !== speechSeq) return true;
    if (c.state === 'suspended') { try { await c.resume(); } catch (_) {} }
    if (c.state !== 'running' || seq !== speechSeq) return seq !== speechSeq;
    stopAudio();
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    audioSrc = src;
    src.onended = () => { if (audioSrc === src) { audioSrc = null; finishSpeech(done); } };
    speakingNow = true;
    src.start(0);
    return true;
  }
  const serverVoiceReady = () => !!settings.serverVoiceOn && serverHas('jarvis-tts') && Date.now() > serverBrokenUntil && hasToken();
  function speak(text, done) {
    cancelSpeech();
    if (!settings.voice || !text) { (done || maybeAutoListen)(); return; }
    const say = String(text), seq = speechSeq;
    if (serverVoiceReady()) {
      speakingNow = true;
      serverSpeak(say, done, seq).then(ok => { if (!ok && seq === speechSeq) deviceSpeak(say, done); });
      return;
    }
    deviceSpeak(say, done);
  }
  function maybeAutoListen() {
    if (!settings.autoListen || !sheetOpen || recState !== 'idle' || document.hidden) return;
    setTimeout(() => { if (sheetOpen && recState === 'idle') startListening(); }, 350);
  }

  const REC_ERRORS = {
    'not-allowed': 'Нет доступа к микрофону. Разрешите микрофон для этого сайта в настройках Chrome.',
    'service-not-allowed': 'Распознавание речи запрещено на этом устройстве. Можно написать команду.',
    'no-speech': 'Ничего не услышал. Нажмите «Говорить» и скажите сразу после сигнала.',
    'audio-capture': 'Микрофон не найден или занят другим приложением.',
    'network': 'Нет интернета: распознавание речи работает через интернет.',
    'aborted': ''
  };
  function startListening() {
    if (recState === 'listening') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setStatus('Голосовой ввод недоступен в этом браузере. Откройте сайт в Chrome или напишите команду.', 'err');
      showText(true);
      return;
    }
    cancelSpeech();
    let r;
    try { r = new SR(); } catch (_) { setStatus('Голосовой ввод недоступен. Напишите команду.', 'err'); showText(true); return; }
    rec = r;
    const finals = [];
    let interim = '', failed = false, timer = 0;
    r.lang = settings.lang;
    r.interimResults = true;
    r.maxAlternatives = 5;
    r.continuous = false;
    r.onstart = () => { setMic('listening'); setStatus('Слушаю… говорите'); setHeard('', ''); };
    r.onresult = e => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finals[i] = Array.from(res).map(a => ({ text: String(a.transcript || ''), conf: a.confidence }));
        else live += res[0] ? res[0].transcript : '';
      }
      interim = live;
      const done = finals.filter(Boolean).map(alts => alts[0].text).join(' ');
      setHeard(done, live);
    };
    r.onerror = e => {
      failed = true;
      const code = e && e.error;
      if (code === 'language-not-supported' || code === 'bad-grammar') {
        if (settings.lang !== 'ru-RU') {
          settings.lang = 'ru-RU'; saveSettings(); renderSettings();
          setStatus('Этот язык не распознаётся на телефоне — включён русский. Нажмите «Говорить» ещё раз.', 'warn');
        } else setStatus('Распознавание речи недоступно.', 'err');
        return;
      }
      const msg = Object.prototype.hasOwnProperty.call(REC_ERRORS, code) ? REC_ERRORS[code] : `Ошибка распознавания (${code || 'нет связи'}).`;
      if (msg) setStatus(msg, code === 'no-speech' ? 'warn' : 'err');
      if (code === 'not-allowed' || code === 'service-not-allowed') showText(true);
    };
    r.onend = () => {
      clearTimeout(timer);
      if (rec === r) rec = null;
      setMic('idle');
      const list = finals.filter(Boolean);
      if (list.length === 1) handleAlternatives(list[0]);
      else if (list.length > 1) handleAlternatives([{ text: list.map(alts => alts[0].text).join(' ') }]);
      else if (interim.trim()) handleAlternatives([{ text: interim }]);
      else if (!failed) setStatus('Ничего не услышал. Нажмите «Говорить» ещё раз.', 'warn');
    };
    timer = setTimeout(() => { try { r.stop(); } catch (_) {} }, 12000);
    try { r.start(); setMic('listening'); }
    catch (_) { rec = null; setMic('idle'); setStatus('Микрофон занят. Подождите секунду и нажмите ещё раз.', 'err'); }
  }
  function stopListening() {
    if (!rec) return;
    try { rec.stop(); } catch (_) {}
  }
  function abortListening() {
    if (!rec) return;
    const r = rec;
    rec = null;
    try { r.onend = null; r.abort(); } catch (_) {}
    setMic('idle');
  }

  async function handleAlternatives(alts) {
    if (!alts || !alts.length) return;
    setMic('busy');
    try {
      await ensureProducts();
      const index = getIndex();
      const context = { room: ctxRoom() };
      let best = null;
      alts.slice(0, 5).forEach(a => {
        const r = Core.parse(a.text, index, context);
        if (!best || r.quality > best.quality + 0.01) best = r;
      });
      setHeard(best.heard, '');
      setStatus(best.actions.length ? 'Выполняю…' : best.questions.length ? 'Уточните ниже' : 'Готово');
      execute(best);
      setTimeout(() => { if (recState === 'idle' && !pending) setStatus('Нажмите «Говорить» для новой команды'); }, 1600);
    } catch (e) {
      setStatus('Ошибка: ' + (e && e.message || e), 'err');
    } finally {
      setMic('idle');
    }
  }
  function handleText(text) {
    const value = String(text || '').trim();
    if (!value) return;
    handleAlternatives([{ text: value }]);
  }

  /* =====================================================================
     ЗНАНИЯ: ответы на вопросы по данным сайта, переходы по разделам, подсказки.
     Всё читается из данных приложения (db, shiftState, payments…) и из тех же API,
     которые сайт уже вызывает. Ничего не записывается.
     ===================================================================== */
  const PORTAL_KEY = 'parordo_manager_portal_active';
  const portalOn = () => { try { return sessionStorage.getItem(PORTAL_KEY) === '1'; } catch (_) { return false; } };
  const canWrite = () => ['admin', 'staff'].includes(role());
  const canFinance = () => ['admin', 'manager'].includes(role());
  const sirWord = () => (settings.address === 'madam' ? 'госпожа' : settings.address === 'none' ? '' : 'сэр');
  const withSir = text => { const s = sirWord(); return s ? String(text).replace(/([.!?])?$/, (m, p) => `, ${s}${p || '.'}`) : text; };
  const leadSir = text => { const s = sirWord(); return s ? `${s[0].toUpperCase()}${s.slice(1)}, ${text[0].toLowerCase()}${text.slice(1)}` : text; };

  const shiftList = () => { try { return currentShiftClients(); } catch (_) { return []; } };
  const payOf = c => { try { return payments(c); } catch (_) { return { cash: 0, transfer: 0, pending: 0 }; } };
  const totalOf = c => { try { return total(c); } catch (_) { return 0; } };
  const availOf = p => Math.max(0, Number(p && (p.available ?? (Number(p.stock || 0) - Number(p.reserved || 0))) || 0));
  const hm = iso => { try { return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bishkek' }); } catch (_) { return ''; } };
  const dayMonth = iso => { try { return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Asia/Bishkek' }); } catch (_) { return ''; } };
  const bishkekDay = (d = new Date()) => { try { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bishkek' }).format(d); } catch (_) { return d.toISOString().slice(0, 10); } };
  const monthKey = () => bishkekDay().slice(0, 7);
  const minutes = ms => Math.max(0, Math.floor(ms / 60000));
  const dur = ms => { const m = minutes(ms), h = Math.floor(m / 60); return h ? `${h} ч ${m % 60} мин` : `${m} мин`; };
  const durSay = ms => {
    const m = minutes(ms), h = Math.floor(m / 60), r = m % 60;
    const mm = `${r} ${plural(r, 'минута', 'минуты', 'минут')}`;
    return h ? `${h} ${plural(h, 'час', 'часа', 'часов')}${r ? ' ' + mm : ''}` : mm;
  };
  // Суммы голосом — коротко, словами («две триста сорок пять сом»). На карточке всегда точная сумма цифрами.
  const amt = n => Core.amountWords(n, false);
  const amtTotal = n => Core.amountWords(n, !!settings.roundTotals);
  const sayMoney = n => `${amt(n)} сом`;
  const sayTotal = n => `${amtTotal(n)} сом`;
  const hmSay = iso => hm(iso).replace(/^0(\d)/, '$1');
  const pcs = n => `${n} ${plural(n, 'штука', 'штуки', 'штук')}`;
  const products_ = () => { const d = appDb(); return d && Array.isArray(d.products) ? d.products : []; };
  const productById = id => products_().find(p => Number(p.id) === Number(id)) || null;

  const remoteCache = new Map();
  async function remote(path, ttl) {
    const hit = remoteCache.get(path);
    if (hit && Date.now() - hit.at < (ttl || 60000)) return hit.data;
    const data = await window.api(path);
    remoteCache.set(path, { at: Date.now(), data });
    return data;
  }

  function shiftStats() {
    const list = shiftList();
    const s = { clients: list.length, active: 0, done: 0, cash: 0, transfer: 0, pending: 0, adult: 0, child: 0, adultSum: 0, childSum: 0, sales: new Map() };
    list.forEach(c => {
      if (c.status === 'active') s.active += 1; else if (c.status === 'completed') s.done += 1;
      const p = payOf(c);
      s.cash += Number(p.cash || 0); s.transfer += Number(p.transfer || 0); s.pending += Number(p.pending || 0);
      (c.items || []).forEach(i => {
        const q = Number(i.qty || 0), sum = Number(i.price || 0) * q;
        if (i.productId == null) {
          if (/детск/i.test(i.name || '')) { s.child += q; s.childSum += sum; }
          else if (/^вход/i.test(i.name || '')) { s.adult += q; s.adultSum += sum; }
        } else {
          const k = Number(i.productId);
          const x = s.sales.get(k) || { id: k, name: i.name, qty: 0, sum: 0 };
          x.qty += q; x.sum += sum;
          s.sales.set(k, x);
        }
      });
    });
    s.paid = s.cash + s.transfer;
    s.total = s.paid + s.pending;
    s.avg = s.clients ? Math.round(s.total / s.clients) : 0;
    return s;
  }
  const activeTimers = () => shiftList().filter(c => c.status === 'active')
    .map(c => ({ c, room: Number(c.room), ms: Date.now() - Date.parse(c.startedAt) }))
    .filter(x => Number.isFinite(x.ms)).sort((a, b) => a.room - b.room);
  const freeRooms = () => { const busy = new Set(shiftList().filter(c => c.status === 'active').map(c => Number(c.room))); const out = []; for (let n = 1; n <= 36; n++) if (!busy.has(n)) out.push(n); return out; };

  /* ---------- карточка ответа ---------- */
  function newCard(title, tone) {
    const card = { title, tone: tone || 'info', big: '', bigNote: '', stats: [], steps: [], list: [], note: '', chips: [], buttons: [], acts: [] };
    card.act = fn => { card.acts.push(fn); return card.acts.length - 1; };
    card.stat = (l, v, cls) => { card.stats.push({ l, v: String(v), cls: cls || '' }); return card; };
    card.row = (l, r, m, cls, fn) => { card.list.push({ l, r: r == null ? '' : String(r), m: m || '', cls: cls || '', act: fn ? card.act(fn) : -1 }); return card; };
    card.button = (label, fn, primary) => { card.buttons.push({ label, act: card.act(fn), primary: !!primary }); return card; };
    card.chip = (label, fn, cls) => { card.chips.push({ label, act: card.act(fn), cls: cls || '' }); return card; };
    return card;
  }
  const result = (card, say) => ({ card, say });
  const SECTION = {
    homeView: 'Номера', productsView: 'Товары и склад', historyView: 'История клиентов', archiveView: 'Архив', reportView: 'Итог смены',
    expensesView: 'Расходы бани', customers: 'База клиентов', qr: 'QR-сканер PAR ORDO GO', menu: 'Меню', manager: 'Панель руководителя',
    clean: 'Clean Control', stats: 'Статистика товаров', daily: 'Ежедневный отчёт', ceo: 'CEO Mode', profit: 'Прибыль', exit: 'Управление баней'
  };
  const SECTION_SAY = { qr: 'кью ар сканер', clean: 'клин контроль', ceo: 'си и о режим', reportView: 'итог смены' };
  const runText = text => () => { if (!sheetOpen) openSheet(); handleText(text); };
  const openClientCard = c => () => { closeSheet(); try { window.openClient(c.id); } catch (_) {} };
  const goSection = target => () => { const batch = newBatch(''); enqueue(batch, b => doNav(target, b)); closeBatch(batch); };

  /* ---------- ответы ---------- */
  function ansSummary() {
    const sh = shift(), s = shiftStats(), tm = activeTimers().filter(x => x.room !== 3);
    const over = tm.filter(x => x.ms >= 3 * 3600e3), near = tm.filter(x => x.ms >= 170 * 60e3 && x.ms < 3 * 3600e3);
    const prods = products_(), low = prods.filter(p => { const a = availOf(p); return a > 0 && a <= 5; }), out = prods.filter(p => availOf(p) <= 0);
    const card = newCard('Сводка');
    card.big = sh.isOpen ? `${s.active} ${plural(s.active, 'активный браслет', 'активных браслета', 'активных браслетов')}` : 'Смена закрыта';
    card.bigNote = sh.isOpen ? `смена открыта с ${hm(sh.openedAt)}` : 'откройте смену, чтобы начать учёт';
    card.stat('Получено', money(s.paid)).stat('Не оплачено', money(s.pending), s.pending ? 'warn' : '').stat('Клиентов за смену', s.clients)
      .stat('Мало на складе', low.length, low.length ? 'warn' : '').stat('Закончилось', out.length, out.length ? 'err' : '');
    over.forEach(x => card.row(`№${x.room} · больше 3 часов`, dur(x.ms), `Клиент ${clientNo(x.c)}`, 'err', openClientCard(x.c)));
    near.forEach(x => card.row(`№${x.room} · скоро 3 часа`, dur(x.ms), `Клиент ${clientNo(x.c)}`, 'warn', openClientCard(x.c)));
    low.slice(0, 4).forEach(p => card.row(p.name, `${availOf(p)} шт.`, 'заканчивается', 'warn'));
    if (sh.isOpen) card.button('Касса смены', runText('касса смены')); else if (canWrite()) card.button('Открыть смену', runText('открой смену'), true);
    card.button('Активные браслеты', runText('активные браслеты'));
    let say = sh.isOpen ? `активных ${s.active}. Касса ${sayTotal(s.paid)}${s.pending ? `, не оплачено ${amtTotal(s.pending)}` : ''}.` : 'смена закрыта.';
    if (over.length) say += ` Больше трёх часов: ${over.map(x => x.room).join(', ')}.`;
    if (low.length) say += ` Заканчивается: ${low.slice(0, 3).map(p => itemSay(p)).join(', ')}.`;
    return result(card, leadSir(say));
  }
  const itemSay = p => { const it = getIndex().byRef.get('p:' + Number(p.id)); return it ? it.say : String(p.name || ''); };

  function ansRevenue() {
    const sh = shift(), s = shiftStats();
    const card = newCard('Касса смены');
    card.big = money(s.paid);
    card.bigNote = sh.isOpen ? `получено с ${hm(sh.openedAt)}` : 'смена закрыта';
    card.stat('Наличные', money(s.cash)).stat('Перевод', money(s.transfer)).stat('Не оплачено', money(s.pending), s.pending ? 'warn' : '')
      .stat('Общий чек', money(s.total)).stat('Средний чек', money(s.avg)).stat('Клиентов', s.clients);
    card.button('Открыть «Итог»', goSection('reportView'), true);
    const say = sh.isOpen ? `Касса ${sayTotal(s.paid)}: наличные ${amtTotal(s.cash)}, перевод ${amtTotal(s.transfer)}.${s.pending ? ` Не оплачено ${amtTotal(s.pending)}.` : ''}` : 'Смена закрыта, касса пуста.';
    return result(card, say);
  }

  async function ansReport(a) {
    if (!canFinance()) {
      const card = newCard('Отчёты прошлых смен', 'warn');
      card.note = 'Финансовые отчёты прошлых смен видит руководитель. Сотруднику доступна касса текущей смены.';
      try { const d = await remote('/api/admin/control/reports', 30000); if (d && d.lastClosedAt) card.stat('Последняя смена закрыта', `${dayMonth(d.lastClosedAt)}, ${hm(d.lastClosedAt)}`); } catch (_) {}
      card.button('Касса текущей смены', runText('касса смены'), true);
      return result(card, 'Отчёты прошлых смен видит руководитель.');
    }
    const d = await remote('/api/admin/control/reports', 30000);
    const reports = Array.isArray(d && d.reports) ? d.reports : [];
    if (!reports.length) { const card = newCard('Отчёты смен', 'warn'); card.note = 'Закрытых смен пока нет.'; return result(card, 'Закрытых смен пока нет.'); }
    const dayOf = r => bishkekDay(new Date(r.shiftStartAt || r.closedAt));
    let pick, label;
    if (a.period === 'week' || a.period === 'month') {
      const now = Date.now();
      pick = reports.filter(r => (a.period === 'week' ? now - Date.parse(r.shiftStartAt || r.closedAt) <= 7 * 864e5 : dayOf(r).slice(0, 7) === monthKey()));
      label = a.period === 'week' ? 'за 7 дней' : 'за этот месяц';
    } else {
      const y = bishkekDay(new Date(Date.now() - 864e5));
      const exact = reports.filter(r => dayOf(r) === y);
      pick = exact.length ? exact : [reports[0]];
      label = exact.length ? `за ${dayMonth(reports.find(r => dayOf(r) === y).shiftStartAt)}` : `последняя смена · ${dayMonth(reports[0].shiftStartAt || reports[0].closedAt)}`;
    }
    const sum = k => pick.reduce((acc, r) => acc + Number(r[k] || 0), 0);
    const paid = sum('paidTotal'), clients = sum('clientCount');
    const card = newCard(`Отчёт ${label}`);
    card.big = money(paid);
    card.bigNote = `${pick.length} ${plural(pick.length, 'смена', 'смены', 'смен')} · получено`;
    card.stat('Наличные', money(sum('cashTotal'))).stat('Перевод', money(sum('transferTotal'))).stat('Не оплачено', money(sum('pendingTotal')))
      .stat('Клиентов', clients).stat('Средний чек', money(clients ? Math.round((paid + sum('pendingTotal')) / clients) : 0));
    if (pick.length > 1) pick.slice(0, 10).forEach(r => card.row(dayMonth(r.shiftStartAt || r.closedAt), money(r.paidTotal), `${r.clientCount} клиентов · закрыл ${r.closedBy || '—'}`));
    else {
      const r = pick[0], cl = r.closingChecklist;
      card.row('Закрыл смену', r.closedBy || '—', `${hm(r.closedAt)}`);
      if (cl && cl.summary) card.row('Проверка закрытия', cl.summary.allOk ? 'всё в порядке' : `замечаний: ${cl.summary.problemCount}`, '', cl.summary.allOk ? '' : 'warn');
    }
    if (document.getElementById('openDailyManagerReport')) card.button('Ежедневный отчёт', () => { closeSheet(); try { document.getElementById('openDailyManagerReport').click(); } catch (_) {} }, true);
    return result(card, `${label[0].toUpperCase()}${label.slice(1)}: ${sayTotal(paid)}, ${clients} ${plural(clients, 'клиент', 'клиента', 'клиентов')}.`);
  }

  function ansClients() {
    const s = shiftStats();
    const card = newCard('Клиенты смены');
    card.big = String(s.clients);
    card.bigNote = plural(s.clients, 'клиент за смену', 'клиента за смену', 'клиентов за смену');
    card.stat('Сейчас в бане', s.active).stat('Завершили', s.done).stat('Взрослых входов', s.adult).stat('Детских входов', s.child);
    card.button('Активные браслеты', runText('активные браслеты'));
    return result(card, `За смену ${s.clients} ${plural(s.clients, 'клиент', 'клиента', 'клиентов')}, сейчас в бане ${s.active}.`);
  }

  function ansActive() {
    const tm = activeTimers();
    const card = newCard('Активные браслеты');
    card.big = String(tm.length);
    card.bigNote = tm.length ? 'нажмите, чтобы открыть чек' : 'сейчас никого нет';
    tm.forEach(x => {
      const p = payOf(x.c);
      card.row(`№${x.room} · Клиент ${clientNo(x.c)}${x.c.customerBaseName ? ' · ' + x.c.customerBaseName : ''}`, dur(x.ms),
        `${(x.c.items || []).length} поз. · ${money(totalOf(x.c))}${p.pending ? ' · не оплачено ' + money(p.pending) : ''}`, x.room !== 3 && x.ms >= 3 * 3600e3 ? 'err' : '', openClientCard(x.c));
    });
    const say = !tm.length ? 'Активных браслетов нет.' : tm.length <= 8 ? `Активных ${tm.length}: ${tm.map(x => x.room).join(', ')}.` : `Активных браслетов ${tm.length}.`;
    return result(card, say);
  }

  function ansFree() {
    const free = freeRooms();
    const card = newCard('Свободные браслеты');
    card.big = String(free.length);
    card.bigNote = canWrite() ? 'нажмите номер, чтобы выдать браслет' : 'из 36';
    free.forEach(n => card.chip(String(n), () => { if (!canWrite()) return; const batch = newBatch(''); enqueue(batch, b => doActivate(n, b)); closeBatch(batch); }, 'num'));
    return result(card, `Свободно ${free.length}${free.length && free.length <= 6 ? ': ' + free.join(', ') : ''}.`);
  }

  function ansRoom(a) {
    const says = [];
    const cards = a.rooms.slice(0, 3).map(n => {
      if (!validRoom(n)) { says.push(`Браслета ${n} нет`); const c = newCard(`Браслета №${n} нет`, 'warn'); c.note = 'Номера браслетов: 1–36.'; return c; }
      const c = clientOf(n);
      if (!c) {
        const card = newCard(`Браслет №${n}`);
        card.big = 'Свободен';
        if (canWrite()) card.button(`Выдать браслет №${n}`, () => { const batch = newBatch(''); enqueue(batch, b => doActivate(n, b)); closeBatch(batch); }, true);
        says.push(`Браслет ${n} свободен`);
        return card;
      }
      setCtx(n);
      const p = payOf(c), ms = Date.now() - Date.parse(c.startedAt), sum = totalOf(c);
      const card = newCard(`Браслет №${n} · Клиент ${clientNo(c)}`);
      card.big = money(sum);
      card.bigNote = `сумма чека · ${(c.items || []).length} ${plural((c.items || []).length, 'позиция', 'позиции', 'позиций')}`;
      card.stat('Время', Number.isFinite(ms) ? dur(ms) : '—', n !== 3 && ms >= 3 * 3600e3 ? 'err' : '').stat('Оплачено', money(Number(p.cash || 0) + Number(p.transfer || 0)))
        .stat('Не оплачено', money(p.pending), p.pending ? 'warn' : '');
      if (c.customerBaseName) card.stat('Гость', `${c.customerBaseName}${c.customerBasePhone ? ' · ' + c.customerBasePhone : ''}`);
      (c.items || []).forEach(i => card.row(`${i.name} ×${i.qty}`, money(Number(i.price || 0) * Number(i.qty || 0)),
        i.method === 'cash' ? 'оплачено наличными' : i.method === 'transfer' ? 'оплачено переводом' : 'ожидает оплаты', i.method === 'pending' ? 'warn' : ''));
      card.button('Открыть чек', openClientCard(c), true);
      if (canWrite()) card.button('Добавить покупку', () => { closeSheet(); try { window.openAdd(c.id); } catch (_) {} });
      const unpaid = !p.pending ? '' : p.pending >= sum ? '. Не оплачено' : `. Не оплачено ${amt(p.pending)}`;
      says.push(`Браслет ${n}: ${sayMoney(sum)}${Number.isFinite(ms) ? ', ' + durSay(ms) : ''}${unpaid}${c.customerBaseName ? '. Гость ' + String(c.customerBaseName).trim().split(/\s+/)[0] : ''}`);
      return card;
    });
    return { cards, say: says.join('. ') + '.' };
  }

  function ansOvertime() {
    const tm = activeTimers().filter(x => x.room !== 3);
    const over = tm.filter(x => x.ms >= 3 * 3600e3), near = tm.filter(x => x.ms >= 170 * 60e3 && x.ms < 3 * 3600e3);
    const card = newCard('Время браслетов', over.length ? 'warn' : 'info');
    card.big = over.length ? `${over.length} ${plural(over.length, 'браслет', 'браслета', 'браслетов')}` : 'Все в пределах 3 часов';
    card.bigNote = over.length ? 'больше 3 часов' : near.length ? 'но скоро истекает у некоторых' : 'лимит не превышен';
    over.forEach(x => card.row(`№${x.room} · Клиент ${clientNo(x.c)}`, dur(x.ms), 'больше 3 часов', 'err', openClientCard(x.c)));
    near.forEach(x => card.row(`№${x.room} · Клиент ${clientNo(x.c)}`, dur(x.ms), 'скоро 3 часа', 'warn', openClientCard(x.c)));
    const say = over.length ? `Больше трёх часов: ${over.map(x => x.room).join(', ')}.` : near.length ? `Скоро три часа: ${near.map(x => x.room).join(', ')}.` : 'Все в пределах трёх часов.';
    return result(card, say);
  }

  function ansEntries(a) {
    const s = shiftStats();
    const card = newCard('Входы за смену');
    card.big = String(s.adult + s.child);
    card.bigNote = plural(s.adult + s.child, 'вход', 'входа', 'входов');
    card.stat('Взрослых', `${s.adult} · ${money(s.adultSum)}`).stat('Детских', `${s.child} · ${money(s.childSum)}`);
    const onlyChild = a.entries.length === 1 && a.entries[0] === 'entry:child';
    return result(card, onlyChild ? `Детских входов: ${s.child}.` : `Входы: взрослых ${s.adult}, детских ${s.child}.`);
  }

  function ansShift() {
    const sh = shift();
    const card = newCard('Смена', sh.isOpen ? 'info' : 'warn');
    if (!sh.loaded) { card.big = 'Проверяю…'; return result(card, 'Статус смены ещё загружается.'); }
    card.big = sh.isClosing ? 'Закрывается' : sh.isOpen ? 'Открыта' : 'Закрыта';
    if (sh.isOpen) {
      card.bigNote = `с ${hm(sh.openedAt)}${sh.openedBy ? ' · открыл ' + sh.openedBy : ''}`;
      card.stat('Идёт', dur(Date.now() - Date.parse(sh.openedAt))).stat('Активных браслетов', shiftStats().active);
      card.button('Как закрыть смену', runText('как закрыть смену'));
    } else if (canWrite() && !sh.isClosing) card.button('Открыть смену', runText('открой смену'), true);
    const say = sh.isOpen ? `Смена открыта с ${hmSay(sh.openedAt)}.` : sh.isClosing ? 'Смена закрывается.' : 'Смена закрыта.';
    return result(card, say);
  }

  function ansOpenShift() {
    const sh = shift();
    if (sh.isOpen) { const card = newCard('Смена уже открыта'); card.bigNote = `с ${hm(sh.openedAt)}`; return result(card, `Смена уже открыта с ${hmSay(sh.openedAt)}.`); }
    if (!canWrite()) return readonlyResult();
    askPending({ kind: 'openShift' });
    return result(null, 'Открыть новую смену?');
  }

  function stockRows(card, list) {
    list.forEach(p => {
      const a = availOf(p);
      card.row(p.name, a > 0 ? `${a} шт.` : 'нет', p.price == null ? 'цена не указана' : money(p.price), a <= 0 ? 'err' : a <= 5 ? 'warn' : '');
    });
  }
  function ansStock(a) {
    const prods = products_();
    if (a.refs.length) {
      const list = a.refs.map(ref => productById(ref.slice(2))).filter(Boolean);
      const card = newCard(list.length === 1 ? list[0].name : 'Остатки');
      if (list.length === 1) { const v = availOf(list[0]); card.big = v > 0 ? `${v} шт.` : 'Закончился'; card.bigNote = list[0].price == null ? 'цена не указана' : `цена ${money(list[0].price)}`; }
      else stockRows(card, list);
      card.button('Открыть «Товары»', goSection('productsView'));
      const say = list.map(p => { const v = availOf(p); return `${itemSay(p)}: ${v > 0 ? pcs(v) : 'нет в наличии'}`; }).join('. ');
      return result(card, say + '.');
    }
    const low = prods.filter(p => { const v = availOf(p); return v > 0 && v <= 5; }).sort((x, y) => availOf(x) - availOf(y));
    const out = prods.filter(p => availOf(p) <= 0);
    const card = newCard(a.out ? 'Закончились' : a.low ? 'Заканчиваются' : 'Склад');
    if (a.out) { card.big = String(out.length); card.bigNote = plural(out.length, 'товар закончился', 'товара закончились', 'товаров закончились'); stockRows(card, out); }
    else if (a.low) { card.big = String(low.length); card.bigNote = 'товаров осталось 5 шт. и меньше'; stockRows(card, low); }
    else {
      card.big = String(prods.length); card.bigNote = plural(prods.length, 'товар в каталоге', 'товара в каталоге', 'товаров в каталоге');
      card.stat('Мало (до 5 шт.)', low.length, low.length ? 'warn' : '').stat('Закончилось', out.length, out.length ? 'err' : '');
      stockRows(card, low.concat(out).slice(0, 8));
    }
    card.button('Открыть «Товары»', goSection('productsView'), true);
    const listSay = l => l.slice(0, 5).map(p => itemSay(p) + (availOf(p) > 0 ? ` ${availOf(p)}` : '')).join(', ');
    const say = a.out ? (out.length ? `Нет в наличии: ${listSay(out)}.` : 'Всё есть в наличии.')
      : a.low ? (low.length ? `Заканчиваются: ${listSay(low)}.` : 'Всего хватает.')
        : `Товаров ${prods.length}. Мало: ${low.length}, нет: ${out.length}.`;
    return result(card, say);
  }

  async function ansPrice(a) {
    const card = newCard('Цены');
    const says = [];
    if (a.entries.length) {
      const pr = await entryPrices();
      card.row('Вход взрослый', money(pr.adult), pricing.active ? 'утренний тариф 10:00–15:00 действует' : '');
      card.row('Вход детский', money(pr.child));
      says.push(`Вход: взрослый ${amt(pr.adult)}, детский ${sayMoney(pr.child)}`);
    }
    a.refs.map(ref => productById(ref.slice(2))).filter(Boolean).forEach(p => {
      card.row(p.name, p.price == null ? 'нет цены' : money(p.price), `остаток ${availOf(p)} шт.`);
      says.push(`${itemSay(p)}: ${p.price == null ? 'цена не указана' : sayMoney(p.price)}`);
    });
    if (card.list.length === 1) { card.title = card.list[0].l; card.big = card.list[0].r; card.bigNote = card.list[0].m; card.list = []; }
    return result(card, says.join('. ') + '.');
  }

  async function ansSales(a) {
    if (a.period === 'month' && canFinance() && !a.refs.length) {
      const d = await remote('/api/admin/control/analytics', 60000);
      const rows = (Array.isArray(d && d.products) ? d.products : []).filter(p => Number(p.soldQty || 0) > 0).slice(0, 8);
      const card = newCard('Популярные товары');
      card.bigNote = 'рейтинг продаж по оплаченным покупкам';
      rows.forEach((p, i) => card.row(`${i + 1}. ${p.name}`, `${p.soldQty} шт.`, `выручка ${money(p.revenue)}`));
      if (document.getElementById('openDailyManagerReport') || portalOn()) card.button('Статистика товаров', goSection('stats'));
      return result(card, rows.length ? `Лидеры: ${rows.slice(0, 3).map(p => `${p.name} ${p.soldQty}`).join(', ')}.` : 'Продаж пока нет.');
    }
    const s = shiftStats();
    const all = [...s.sales.values()].sort((x, y) => y.qty - x.qty || y.sum - x.sum);
    const card = newCard(a.refs.length ? 'Продано за смену' : 'Хиты смены');
    if (a.refs.length) {
      const ids = new Set(a.refs.map(r => Number(r.slice(2))));
      const rows = a.refs.map(r => productById(r.slice(2))).filter(Boolean).map(p => s.sales.get(Number(p.id)) || { id: p.id, name: p.name, qty: 0, sum: 0 });
      if (rows.length === 1) { card.title = rows[0].name; card.big = `${rows[0].qty} шт.`; card.bigNote = `продано за смену · ${money(rows[0].sum)}`; }
      else rows.forEach(x => card.row(x.name, `${x.qty} шт.`, money(x.sum)));
      void ids;
      return result(card, rows.map(x => `${itemSay(productById(x.id) || x)}: продано ${x.qty}`).join('. ') + '.');
    }
    card.bigNote = all.length ? 'по количеству за текущую смену' : 'продаж в этой смене пока нет';
    all.slice(0, 8).forEach((x, i) => card.row(`${i + 1}. ${x.name}`, `${x.qty} шт.`, money(x.sum)));
    if (canFinance()) card.button('За всё время', runText('топ товаров за месяц'));
    return result(card, all.length ? `Хиты смены: ${all.slice(0, 3).map(x => `${itemSay(productById(x.id) || x)} ${x.qty}`).join(', ')}.` : 'Продаж пока нет.');
  }

  async function customerList() {
    try {
      if (typeof customerBaseLoaded !== 'undefined' && customerBaseLoaded && Array.isArray(customerBaseEntries) && customerBaseEntries.length) {
        return { customers: customerBaseEntries, summary: (typeof customerBaseSummary !== 'undefined' && customerBaseSummary) || {} };
      }
    } catch (_) {}
    const d = await remote('/api/admin/control/customer-base', 60000);
    return { customers: Array.isArray(d && d.customers) ? d.customers : [], summary: (d && d.summary) || {} };
  }
  function findCustomers(list, q) {
    if (q.phone) return list.filter(c => String(c.phone || '').replace(/\D+/g, '').includes(q.phone.slice(-7)));
    const terms = String(q.text || '').split(' ').filter(t => t.length >= 2).map(t => Core.phon(t));
    if (!terms.length) return [];
    const scored = list.map(c => {
      const words = Core.norm(c.name).split(' ').filter(Boolean);
      let score = 0;
      for (const t of terms) {
        let best = 0;
        for (const w of words) {
          const pw = Core.phon(w);
          if (pw === t) best = Math.max(best, 1);
          else if (pw.startsWith(t) || t.startsWith(pw)) best = Math.max(best, 0.85);
          else if (Core.tokSim(t, pw) >= 0.74) best = Math.max(best, 0.75);
        }
        score += best;
      }
      return { c, score: score / terms.length };
    }).filter(x => x.score >= 0.7).sort((x, y) => y.score - x.score || Number(y.c.totalSpent || 0) - Number(x.c.totalSpent || 0));
    return scored.map(x => x.c);
  }
  async function ansCustomer(a) {
    const q = a.query || {};
    if (!q.text && !q.phone) return ansCustomerCount();
    const { customers } = await customerList();
    const found = findCustomers(customers, q).slice(0, 5);
    const label = q.phone ? q.phone : q.text;
    if (!found.length) {
      const card = newCard(`Клиент «${label}»`, 'warn');
      card.note = 'В базе не найден. Проверьте имя или скажите номер телефона.';
      card.button('Открыть базу клиентов', goSection('customers'));
      return result(card, `Клиент ${label} в базе не найден.`);
    }
    const card = newCard(found.length === 1 ? found[0].name : `Найдено: ${found.length}`);
    const bonus = c => { try { return window.PARORDOBonus && typeof window.PARORDOBonus.account === 'function' ? window.PARORDOBonus.account(c) : null; } catch (_) { return null; } };
    found.forEach(c => {
      const b = bonus(c);
      card.row(`${c.name}`, c.phone || '', `визитов ${Number(c.visitsTotal || 0)} · в этом месяце ${Number(c.visitsThisMonth || 0)} · потратил ${money(c.totalSpent)}${b ? ' · бонус ' + money(b.available) : ''}${c.bonusAvailable ? ' · 5-й визит бесплатно' : ''}`, '', () => {
        const tel = String(c.phone || '').replace(/[^\d+]/g, ''); if (tel) window.location.href = 'tel:' + tel;
      });
    });
    if (found.length === 1) {
      const c = found[0], b = bonus(c);
      card.big = c.phone || '—';
      card.bigNote = 'нажмите строку ниже, чтобы позвонить';
      card.stat('Визитов всего', Number(c.visitsTotal || 0)).stat('В этом месяце', Number(c.visitsThisMonth || 0)).stat('Потратил', money(c.totalSpent));
      if (b) card.stat('Бонусный счёт', money(b.available), b.available ? 'ok' : '');
      if (c.bonusAvailable) card.stat('5-й визит', 'бесплатный вход доступен', 'ok');
    }
    card.button('Открыть базу клиентов', goSection('customers'));
    const c = found[0], b = bonus(c);
    const visits = Number(c.visitsTotal || 0);
    const say = `${c.name}: ${visits} ${plural(visits, 'визит', 'визита', 'визитов')}${b && b.available ? `, бонус ${sayMoney(b.available)}` : ''}${c.bonusAvailable ? '. Пятый визит бесплатно' : ''}.`;
    return result(card, found.length > 1 ? `Нашёл ${found.length}. ${say}` : say);
  }
  async function ansCustomerCount() {
    const { customers, summary } = await customerList();
    const card = newCard('База клиентов');
    const n = Number(summary.customers ?? customers.length);
    card.big = String(n);
    card.bigNote = plural(n, 'клиент в базе', 'клиента в базе', 'клиентов в базе');
    if (summary.completedVisits != null) card.stat('Посещений всего', Number(summary.completedVisits));
    if (summary.customerRevenue != null && canFinance()) card.stat('Потрачено клиентами', money(summary.customerRevenue));
    const ready = customers.filter(c => c.bonusAvailable).length;
    if (ready) card.stat('Бесплатный 5-й визит доступен', ready, 'ok');
    card.button('Открыть базу клиентов', goSection('customers'), true);
    return result(card, `В базе ${n} ${plural(n, 'клиент', 'клиента', 'клиентов')}.`);
  }

  async function ansExpenses(a) {
    const d = await remote(`/api/admin/control/expenses?month=${encodeURIComponent(monthKey())}`, 30000);
    const s = (d && d.summary) || {}, list = Array.isArray(d && d.expenses) ? d.expenses : [];
    const card = newCard(a.period === 'month' ? 'Расходы за месяц' : 'Расходы');
    if (a.period === 'month') { card.big = money(s.monthTotal); card.bigNote = `${Number(s.countMonth || 0)} записей · ${monthKey()}`; card.stat('Сегодня', money(s.todayTotal)); }
    else { card.big = money(s.todayTotal); card.bigNote = `сегодня · ${Number(s.countToday || 0)} записей`; card.stat('За месяц', money(s.monthTotal)); }
    Object.entries(s.byCategory || {}).sort((x, y) => y[1] - x[1]).slice(0, 4).forEach(([cat, sum]) => card.stat(cat, money(sum)));
    list.slice(0, 4).forEach(e => card.row(e.title || e.category, money(e.amount), `${e.spentAt || ''} · ${e.category || ''}`));
    card.button('Открыть «Расходы»', goSection('expensesView'), true);
    const say = a.period === 'month' ? `Расходы за месяц ${sayTotal(s.monthTotal)}, сегодня ${amtTotal(s.todayTotal)}.` : `Расходы сегодня ${sayTotal(s.todayTotal)}, за месяц ${amtTotal(s.monthTotal)}.`;
    return result(card, say);
  }

  async function ansProfit() {
    if (!canFinance()) return managerOnlyResult('Прибыль');
    const d = await remote(`/api/admin/control/profit?month=${encodeURIComponent(monthKey())}`, 60000);
    const s = d && d.summary;
    const card = newCard('Прибыль за месяц');
    if (!s) { card.tone = 'warn'; card.note = 'Расчёт прибыли сейчас недоступен.'; return result(card, 'Расчёт прибыли сейчас недоступен.'); }
    const complete = !!s.costComplete;
    card.big = complete ? money(s.netProfit) : money(Number(s.entryRevenue || 0) + Number(s.productRevenue || 0));
    card.bigNote = complete ? `чистая прибыль после расходов · ${s.month || monthKey()}` : 'выручка за месяц — у части товаров нет закупочной цены';
    card.stat('Доход от входов', money(s.entryRevenue)).stat('Выручка от товаров', money(s.productRevenue))
      .stat('Закупка проданных товаров', complete ? money(s.productCost) : 'не указана').stat('Расходы за месяц', money(s.expenses));
    if (complete) card.stat('Прибыль от товаров', money(s.productGrossProfit), 'ok');
    card.button(portalOn() ? 'Показать на панели' : 'Панель руководителя', goSection(portalOn() ? 'profit' : 'manager'), true);
    const say = complete ? `Чистая прибыль за месяц ${sayTotal(s.netProfit)}. Расходы ${amtTotal(s.expenses)}.`
      : `Выручка за месяц ${sayTotal(Number(s.entryRevenue || 0) + Number(s.productRevenue || 0))}. Для чистой прибыли нужны закупочные цены.`;
    return result(card, say);
  }

  async function ansBookings() {
    const d = await remote('/api/admin/control/bookings', 30000);
    const list = (Array.isArray(d && d.bookings) ? d.bookings : []).slice().sort((x, y) => String(x.appointmentAt).localeCompare(String(y.appointmentAt)));
    const today = bishkekDay();
    const todays = list.filter(b => String(b.appointmentAt).slice(0, 10) === today);
    const show = todays.length ? todays : list.slice(0, 5);
    const card = newCard(todays.length ? 'Брони на сегодня' : 'Ближайшие брони');
    card.big = String(todays.length ? todays.length : list.length);
    card.bigNote = todays.length ? plural(todays.length, 'бронь сегодня', 'брони сегодня', 'броней сегодня') : list.length ? 'сегодня броней нет' : 'броней нет';
    show.forEach(b => card.row(`${String(b.appointmentAt).slice(11, 16)} · ${b.name}`, b.phone || '', `${String(b.appointmentAt).slice(0, 10) === today ? 'сегодня' : String(b.appointmentAt).slice(8, 10) + '.' + String(b.appointmentAt).slice(5, 7)}${b.note ? ' · ' + b.note : ''}`));
    card.button('Открыть базу клиентов', goSection('customers'));
    const at = b => String(b.appointmentAt).slice(11, 16).replace(/^0(\d)/, '$1');
    const say = todays.length ? `Сегодня ${todays.length} ${plural(todays.length, 'бронь', 'брони', 'броней')}: ${todays.slice(0, 3).map(b => `в ${at(b)} ${b.name}`).join(', ')}.` : list.length ? `Сегодня броней нет. Ближайшая ${dayMonth(String(list[0].appointmentAt).slice(0, 10) + 'T12:00:00')} в ${at(list[0])}.` : 'Броней нет.';
    return result(card, say);
  }

  function ansTime(a) {
    const now = new Date();
    const time = hm(now.toISOString());
    let date = '';
    try { date = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Bishkek' }); } catch (_) { date = ''; }
    const card = newCard(a.topic === 'date' ? 'Сегодня' : 'Время');
    card.big = a.topic === 'date' ? date : time;
    card.bigNote = a.topic === 'date' ? time : date;
    return result(card, a.topic === 'date' ? `Сегодня ${date}.` : `Сейчас ${time.replace(/^0(\d)/, '$1')}.`);
  }

  function ansHelp() {
    const card = newCard('Что умеет Джарвис');
    card.note = 'Нажмите любой вопрос — Джарвис ответит. Команды можно говорить по-кыргызски и по-русски.';
    if (canWrite()) {
      card.row('Браслеты и покупки', '', '«3 браслет активный кыл» · «бирге жарма кош» · «5 номерге 2 кола» · «отмена»');
    }
    card.row('Смена и касса', '', '«сводка» · «касса смены» · «смена открыта?»');
    card.row('Браслеты', '', '«сколько активных» · «что на 5 браслете» · «у кого время вышло»');
    card.row('Склад', '', '«сколько осталось жармы» · «что заканчивается» · «сколько стоит кола»');
    card.row('Клиенты', '', '«найди клиента Азамат» · «бонус Азамата» · «брони на сегодня»');
    card.row('Разделы', '', '«открой склад» · «база клиентов» · «панель руководителя»');
    if (canFinance()) card.row('Руководителю', '', '«отчёт за вчера» · «прибыль за месяц» · «топ товаров за месяц» · «расходы за месяц»');
    card.row('Подсказки', '', '«как закрыть смену» · «как добавить товар» · «как работает бонус»');
    ['Сводка', 'Касса смены', 'Сколько активных', 'Что заканчивается', 'Как закрыть смену'].forEach(t => card.chip(t, runText(t.toLowerCase())));
    return result(card, withSir('Спросите про смену, браслеты, склад или клиентов'));
  }

  const FAQ_TEXT = {
    close_shift: { title: 'Как закрыть смену', nav: 'reportView', steps: ['Откройте «Итог» в нижнем меню.', 'Ответьте на все пункты «Проверки закрытия» — Да или Нет. При «Нет» напишите комментарий.', 'Нажмите «✓ Завершить смену и отправить отчёт руководителю».', 'Отчёт сохранится и появится у руководителя в «Ежедневном отчёте».'], say: 'Откройте Итог, ответьте на проверку закрытия и нажмите Завершить смену. Отчёт уйдёт руководителю.' },
    open_shift: { title: 'Как открыть смену', nav: 'homeView', steps: ['На экране «Номера» нажмите «Открыть смену».', 'Или скажите Джарвису: «открой смену».'], say: 'На экране Номера нажмите Открыть смену. Или скажите мне: открой смену.' },
    activate: { title: 'Как выдать браслет', nav: 'homeView', steps: ['На экране «Номера» у свободного браслета нажмите «＋ Выдать браслет».', 'Или скажите: «5 браслет активный кыл».'], say: 'У свободного браслета нажмите Выдать браслет, или скажите: пять браслет активный кыл.' },
    add_purchase: { title: 'Как добавить покупку', nav: 'homeView', steps: ['У активного браслета нажмите «＋ Покупка» и выберите товар.', 'Или скажите: «5 номерге жарма кош», «бирге эки кола».'], say: 'Нажмите Покупка у браслета, или скажите: пять номерге жарма кош.' },
    payment: { title: 'Как отметить оплату', nav: 'homeView', steps: ['Откройте клиента: «Открыть» на карточке браслета.', 'У каждой позиции выберите «Наличные» или «Перевод».'], say: 'Откройте клиента и у каждой позиции выберите Наличные или Перевод.' },
    complete: { title: 'Как завершить клиента', nav: 'homeView', steps: ['Откройте клиента и отметьте оплату всех позиций.', 'Нажмите «✓ Завершить клиента» — браслет освободится.'], say: 'Отметьте оплату всех позиций и нажмите Завершить клиента. Браслет освободится.' },
    new_product: { title: 'Как добавить новый товар', nav: 'productsView', steps: ['Откройте «Товары» и нажмите «Добавить товар».', 'Укажите название, категорию и цену продажи.', 'Во время покупки можно так же: «＋ Добавить товар в каталог».'], say: 'В разделе Товары нажмите Добавить товар и укажите название, категорию и цену.' },
    receipt: { title: 'Как оформить поступление', nav: 'productsView', steps: ['Откройте «Товары» и найдите товар.', 'В поле «+шт.» введите количество и нажмите «＋».'], say: 'В разделе Товары у товара введите количество в поле плюс штук и нажмите плюс.' },
    register: { title: 'Как зарегистрировать клиента', nav: 'customers', steps: ['Откройте «База клиентов».', 'Заполните имя и телефон.', 'Нажмите «＋ Сохранить клиента».'], say: 'Откройте Базу клиентов, заполните имя и телефон и нажмите Сохранить клиента.' },
    bonus: { title: 'Как работает бонус', nav: 'customers', steps: ['С каждой оплаченной покупки гостя 3% копится на его бонусном счёте.', 'Бонусом можно оплатить позицию в чеке гостя.', 'Пятый визит в месяц — бесплатный вход, если бонус активирован в базе клиентов.'], say: 'С каждой оплаченной покупки три процента копятся на бонусном счёте гостя. Пятый визит в месяц бесплатный, если бонус активирован.' },
    expense: { title: 'Как добавить расход', nav: 'expensesView', steps: ['Откройте «Расходы бани».', 'Нажмите «＋ Добавить расход»: сумма, категория, способ оплаты.', 'Сохраните — расход попадёт в отчёт месяца.'], say: 'Откройте Расходы бани и нажмите Добавить расход: сумма, категория и способ оплаты.' },
    qr: { title: 'Как принять клиента по QR', nav: 'qr', steps: ['Откройте «PAR ORDO GO · QR сканер».', 'Наведите камеру на QR-код в приложении клиента.', 'Нажмите «Принять» и выберите браслет.'], say: 'Откройте QR сканер, наведите камеру на код клиента, нажмите Принять и выберите браслет.' },
    manager: { title: 'Как открыть панель руководителя', nav: 'manager', steps: ['Откройте меню ☰.', 'Нажмите «Руководитель панели».', 'Введите логин и пароль руководителя.'], say: 'Откройте меню, нажмите Руководитель панели и введите логин и пароль.' },
    clean: { title: 'Clean Control', nav: 'clean', steps: ['На экране «Номера» нажмите карточку «CLEAN CONTROL PRO».', 'Отмечайте выполненные задачи уборки.'], say: 'На экране Номера откройте карточку клин контроль.' },
    archive: { title: 'Как работает архив', nav: 'historyView', steps: ['Завершённые клиенты попадают в «Историю».', 'Кнопка «Архивировать всё» в «Истории» переносит их в «Архив». Суммы сохраняются.'], say: 'Завершённые клиенты попадают в Историю. Кнопка Архивировать всё переносит их в Архив.' },
    jarvis: { title: 'Как говорить с Джарвисом', nav: '', steps: ['Нажмите золотую кнопку «Джарвис» и «Говорить».', 'Скажите команду или вопрос сразу после сигнала.', 'Ошибку можно отменить: «отмена».'], say: 'Нажмите Говорить и скажите команду сразу после сигнала.' }
  };
  function ansHowto(a) {
    const f = FAQ_TEXT[a.faq];
    if (!f) return ansUnknown();
    const card = newCard(f.title);
    card.steps = f.steps.slice();
    if (f.nav) card.button(`Открыть: ${SECTION[f.nav] || f.nav}`, goSection(f.nav), true);
    if (a.faq === 'open_shift' && canWrite() && !shift().isOpen) card.button('Открыть смену сейчас', runText('открой смену'));
    return result(card, f.say);
  }
  function ansWhere(a) {
    const card = newCard(SECTION[a.target] || 'Раздел');
    card.note = a.target === 'manager' ? 'Меню ☰ → «Руководитель панели».' : a.target === 'customers' ? 'Экран «Номера» → «База клиентов».'
      : a.target === 'qr' ? 'Экран «Номера» → «PAR ORDO GO · QR сканер».' : 'Нижнее меню или меню ☰.';
    card.button(`Открыть: ${SECTION[a.target] || a.target}`, goSection(a.target), true);
    return result(card, `${SECTION_SAY[a.target] || SECTION[a.target] || 'Раздел'}: ${card.note.replace(/[«»☰→]/g, ' ')} Открыть?`);
  }
  function ansUnknown() {
    const card = newCard('Пока не знаю ответа', 'warn');
    card.note = 'Спросите иначе или выберите вопрос:';
    ['Сводка', 'Касса смены', 'Сколько активных', 'Что заканчивается', 'Что ты умеешь'].forEach(t => card.chip(t, runText(t.toLowerCase())));
    return result(card, leadSir('Пока не знаю ответа. Выберите вопрос на экране.'));
  }
  function managerOnlyResult(what) {
    const card = newCard(what, 'warn');
    card.note = 'Эти данные доступны руководителю. Войдите в «Руководитель панели».';
    card.button('Руководитель панели', goSection('manager'), true);
    return result(card, `${what} доступна руководителю.`);
  }
  function readonlyResult() {
    const card = newCard('Режим руководителя', 'warn');
    card.note = 'В панели руководителя Джарвис только показывает данные. Браслеты и покупки ведёт персонал.';
    return result(card, 'В режиме руководителя я только показываю данные.');
  }

  const ANSWERS = {
    summary: ansSummary, revenue: ansRevenue, report: ansReport, clients: ansClients, active: ansActive, free: ansFree, room: ansRoom,
    overtime: ansOvertime, entries: ansEntries, shift: ansShift, open_shift: ansOpenShift, stock: ansStock, price: ansPrice, sales: ansSales,
    customer: ansCustomer, customer_count: ansCustomerCount, expenses: ansExpenses, profit: ansProfit, bookings: ansBookings,
    time: ansTime, date: ansTime, help: ansHelp, howto: ansHowto, where: ansWhere, unknown_q: ansUnknown,
    greet: () => { const c = newCard(`Здравствуйте${sirWord() ? ', ' + sirWord() : ''}`); c.note = 'Спросите о смене, браслетах, складе или клиентах.'; return result(c, withSir('Здравствуйте. Чем могу помочь')); },
    thanks: () => result(null, withSir('Всегда пожалуйста')),
    who: () => { const c = newCard('Джарвис'); c.note = 'Голосовой помощник ПАР ОРДО ПРО: отвечаю на вопросы по сайту, открываю разделы, веду браслеты и покупки.'; return result(c, 'Я Джарвис, помощник ПАР ОРДО ПРО. Отвечаю на вопросы, открываю разделы и веду браслеты голосом.'); }
  };
  const REMOTE_TOPICS = new Set(['report', 'customer', 'customer_count', 'expenses', 'profit', 'bookings', 'price']);

  async function doAsk(a, batch) {
    const fn = ANSWERS[a.topic] || ansUnknown;
    let wait = null;
    if (REMOTE_TOPICS.has(a.topic) && !(a.topic === 'price' && !a.entries.length)) wait = addRow({ state: 'wait', title: 'Смотрю данные…', meta: '' });
    let res;
    try { res = await fn(a); }
    catch (e) {
      const msg = String(e && e.message || e);
      const denied = /403|прав|доступ|forbidden/i.test(msg);
      res = denied ? managerOnlyResult('Эта информация') : result(Object.assign(newCard('Не удалось получить данные', 'err'), { note: msg }), 'Не удалось получить данные. Проверьте интернет.');
    }
    if (wait) { const i = rows.indexOf(wait); if (i >= 0) rows.splice(i, 1); }
    const cards = res.cards || (res.card ? [res.card] : []);
    cards.slice().reverse().forEach(card => addRow({ kind: 'card', card, state: card.tone || 'info' }));
    if (!cards.length) renderRows();
    if (res.say) batch.say.push(res.say);
  }

  async function doNav(target, batch) {
    const name = SECTION[target] || target, sayName = SECTION_SAY[target] || name;
    const done = () => { batch.say.push(`Открываю: ${sayName}`); };
    const views = ['homeView', 'productsView', 'historyView', 'archiveView', 'reportView', 'expensesView'];
    const click = id => { const el = document.getElementById(id); if (!el) return false; el.click(); return true; };
    if (views.includes(target)) { closeSheet(); try { window.navigate(target); } catch (_) {} done(); return; }
    if (target === 'customers') { closeSheet(); try { await window.openCustomerBase(); } catch (_) {} done(); return; }
    if (target === 'qr') {
      if (!canWrite()) { const r = result(Object.assign(newCard('QR-сканер', 'warn'), { note: 'QR-сканер доступен персоналу и администратору.' }), 'QR сканер доступен персоналу.'); addRow({ kind: 'card', card: r.card, state: 'warn' }); batch.say.push(r.say); return; }
      closeSheet(); try { await window.openGoScanner(); } catch (_) {} done(); return;
    }
    if (target === 'menu') { closeSheet(); click('menuButton'); done(); return; }
    if (target === 'clean') { closeSheet(); const link = document.querySelector('#poCleanControlLauncherV83 a, a#poCleanControlLauncherV83, a[href*="clean-control"]'); if (link) link.click(); else window.location.href = './clean-control.html'; done(); return; }
    if (target === 'exit') { closeSheet(); if (portalOn() && click('managerExitToControl')) done(); else { try { window.navigate('homeView'); } catch (_) {} done(); } return; }
    if (target === 'manager') {
      closeSheet();
      if (portalOn()) { try { window.navigate('managerView'); } catch (_) {} }
      else click('openManagerLogin');
      done();
      return;
    }
    if (!canFinance()) { const r = managerOnlyResult(name); addRow({ kind: 'card', card: r.card, state: 'warn' }); batch.say.push(r.say); return; }
    if (target === 'stats') { closeSheet(); try { await window.openProductStats(); } catch (_) {} done(); return; }
    if (target === 'daily') { closeSheet(); click('openDailyManagerReport'); done(); return; }
    if (target === 'ceo') { closeSheet(); click('poCeoLaunch'); done(); return; }
    if (target === 'profit') {
      if (!portalOn()) { await doAsk({ topic: 'profit', refs: [], entries: [], rooms: [] }, batch); return; }
      closeSheet();
      try { window.navigate('managerView'); } catch (_) {}
      setTimeout(() => { const el = document.getElementById('managerProfitPanel'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 450);
      done();
    }
  }

  /* ---------- приветствие при входе ---------- */
  let appWasVisible = false;
  const hasToken = () => { try { return !!sessionStorage.getItem('parordo_admin_token'); } catch (_) { return false; } };
  function greetingSpeech(mode) {
    const sh = shift(), s = shiftStats(), sir = sirWord();
    const head = mode === 'manager' ? `Добро пожаловать в панель руководителя${sir ? ', ' + sir : ''}.` : `Добро пожаловать в Пар Ордо Про${sir ? ', ' + sir : ''}.`;
    if (!sh.loaded) return head;
    return `${head} ${sh.isOpen ? `Активных браслетов: ${s.active}.` : 'Смена закрыта.'}`;
  }
  function showGreetBanner(mode) {
    let el = document.getElementById('poJvGreet');
    if (!el) { el = document.createElement('div'); el.id = 'poJvGreet'; el.setAttribute('role', 'status'); document.body.appendChild(el); el.addEventListener('click', () => { el.hidden = true; }); }
    const sh = shift(), s = shiftStats(), sir = sirWord();
    const title = mode === 'manager' ? `Добро пожаловать в панель руководителя${sir ? ', ' + sir : ''}` : `Добро пожаловать в PAR ORDO PRO${sir ? ', ' + sir : ''}`;
    const sub = !sh.loaded ? 'Джарвис на связи' : sh.isOpen ? `Смена открыта · активных браслетов: ${s.active}` : 'Смена закрыта';
    el.innerHTML = `<span class="jv-greet-orb" aria-hidden="true">${I.mic}</span><div><b>${esc(title)}</b><small>${esc(sub)}</small></div>`;
    el.hidden = false;
    el.classList.remove('jv-greet-in'); void el.offsetWidth; el.classList.add('jv-greet-in');
    clearTimeout(showGreetBanner.t);
    showGreetBanner.t = setTimeout(() => { el.hidden = true; }, 5200);
  }
  function greet(mode) {
    showGreetBanner(mode);
    const text = greetingSpeech(mode);
    const active = !navigator.userActivation || navigator.userActivation.hasBeenActive;
    if (active) { speak(text); return; }
    const once = () => { document.removeEventListener('pointerdown', once, true); speak(text); };
    document.addEventListener('pointerdown', once, true);
  }
  function scheduleGreeting(mode) {
    if (!settings.greet) return;
    const key = mode === 'manager' ? 'po_jv_greet_mgr' : 'po_jv_greet';
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch (_) {}
    const started = Date.now();
    const wait = () => {
      const deal = window.PARORDODeal && typeof window.PARORDODeal.playing === 'function' && window.PARORDODeal.playing();
      const busy = document.documentElement.classList.contains('po-vault-busy') || deal || (!shift().loaded && Date.now() - started < 4000);
      if (busy && Date.now() - started < 9000) { setTimeout(wait, 300); return; }
      setTimeout(() => greet(mode), 450);
    };
    wait();
  }
  function checkGreeting() {
    const app = document.getElementById('appView');
    const visible = !!app && !app.classList.contains('hidden') && hasToken();
    if (visible && !appWasVisible) scheduleGreeting(portalOn() ? 'manager' : 'app');
    appWasVisible = visible;
    if (visible && portalOn() && document.querySelector('#managerView.active')) scheduleGreeting('manager');
  }

  /* ---------- оповещения Джарвиса: браслеты 2:50 и 3:00, склад ---------- */
  // Говорит сам, без вопроса: персонал и администратор (не панель руководителя), только при открытой смене.
  // Каждое оповещение — один раз (помнится на этом телефоне 36 часов, повторов после обновления страницы нет).
  const ALERT_STORE = 'parordo_jarvis_alerts_v1';
  const ROOM_WARN_MIN = 170, ROOM_LIMIT_MIN = 180;
  let alertSeen = readJSON(ALERT_STORE, {});
  const alertQueue = [];
  let lastAlertAt = 0, stockSnap = null, alertRetry = 0, alertGestureWait = false;
  function markAlert(key) {
    alertSeen[key] = Date.now();
    const cut = Date.now() - 36 * 3600e3;
    Object.keys(alertSeen).forEach(k => { if (!(alertSeen[k] >= cut)) delete alertSeen[k]; });
    writeJSON(ALERT_STORE, alertSeen);
  }
  const appOpen = () => { const app = document.getElementById('appView'); return !!app && !app.classList.contains('hidden') && hasToken(); };
  const alertsAllowed = () => canWrite() && !portalOn() && appOpen() && !!shift().isOpen;
  const roomsSay = rooms => (rooms.length === 1 ? `Браслет ${rooms[0]}` : `Браслеты ${rooms.slice(0, -1).join(', ')} и ${rooms[rooms.length - 1]}`);
  const roomsTitle = rooms => rooms.map(n => '№' + n).join(', ');
  function checkRooms() {
    const now = Date.now(), warn = [], over = [];
    shiftList().forEach(c => {
      if (!c || c.status !== 'active' || Number(c.room) === 3) return;
      const t = Date.parse(c.startedAt);
      if (!Number.isFinite(t)) return;
      const min = (now - t) / 60000, kw = `r${c.id}:w`, ko = `r${c.id}:o`;
      if (min >= ROOM_LIMIT_MIN + 0.2) {
        // 3:00:12 — к этому времени time-alert уже добавил «Вход» 300 сом. Старые (больше 15 минут) — без голоса.
        if (!alertSeen[ko]) { markAlert(kw); markAlert(ko); if (min < ROOM_LIMIT_MIN + 15) over.push(c); }
      } else if (min >= ROOM_WARN_MIN && !alertSeen[kw]) {
        markAlert(kw);
        warn.push({ c, left: Math.max(1, Math.ceil(ROOM_LIMIT_MIN - min)) });
      }
    });
    if (over.length) {
      const rooms = over.map(c => Number(c.room)).sort((a, b) => a - b);
      const fee = over.every(c => (c.items || []).some(i => i && i.autoTimeFee === 'over3h'));
      queueAlert({
        tone: 'err', title: `${roomsTitle(rooms)} · прошло 3 часа`,
        sub: fee ? '«Вход» 300 сом добавлен автоматически' : 'Время браслета истекло',
        say: `${roomsSay(rooms)}: три часа прошло${fee ? ', добавлен вход триста сом' : ''}.`,
        open: over.length === 1 ? over[0] : null
      });
    }
    if (warn.length) {
      const rooms = warn.map(x => Number(x.c.room)).sort((a, b) => a - b);
      const left = Math.min(...warn.map(x => x.left));
      queueAlert({
        tone: 'warn', title: `${roomsTitle(rooms)} · скоро 3 часа`,
        sub: `Осталось ${left} ${plural(left, 'минута', 'минуты', 'минут')}`,
        say: `${roomsSay(rooms)}: через ${left} ${plural(left, 'минуту', 'минуты', 'минут')} три часа.`,
        open: warn.length === 1 ? warn[0].c : null
      });
    }
  }
  function checkStock() {
    const list = products_().filter(p => p && p.price != null && p.active !== false);
    const snap = new Map(list.map(p => [Number(p.id), availOf(p)]));
    const prev = stockSnap;
    stockSnap = snap;
    if (!prev) return;   // первый снимок после входа — только запоминаем
    const low = [], out = [];
    snap.forEach((v, id) => {
      const was = prev.get(id);
      if (was == null || v === was) return;
      const kl = `s${id}:l`, ko = `s${id}:o`;
      if (v > was) {       // поступление: дальше снова можно предупреждать
        if (v > 2 && (alertSeen[kl] || alertSeen[ko])) { delete alertSeen[kl]; delete alertSeen[ko]; writeJSON(ALERT_STORE, alertSeen); }
        return;
      }
      if (v <= 0) { if (!alertSeen[ko]) { markAlert(kl); markAlert(ko); out.push(id); } }
      else if (v <= 2 && !alertSeen[kl]) { markAlert(kl); low.push(id); }
    });
    if (!low.length && !out.length) return;
    const nameOf = id => (productById(id) || {}).name || '';
    const sayOf = id => { const p = productById(id); return p ? itemSay(p) : ''; };
    const parts = [];
    if (out.length) parts.push(`Нет в наличии: ${out.map(sayOf).join(', ')}.`);
    if (low.length) parts.push(low.length === 1 ? `${sayOf(low[0])}: осталось ${snap.get(low[0])}.` : `Заканчиваются: ${low.map(id => `${sayOf(id)} ${snap.get(id)}`).join(', ')}.`);
    queueAlert({
      tone: out.length ? 'err' : 'warn',
      title: out.length ? 'Склад: товар закончился' : 'Склад: товар заканчивается',
      sub: out.map(id => `${nameOf(id)} — нет`).concat(low.map(id => `${nameOf(id)} — ${snap.get(id)} шт.`)).join(' · '),
      say: parts.join(' '),
      nav: 'productsView'
    });
  }
  function queueAlert(a) {
    a.at = Date.now();
    showAlertBanner(a);
    if (sheetOpen) addRow({ state: a.tone === 'err' ? 'err' : 'warn', title: a.title, meta: a.sub });
    alertQueue.push(a);
    flushAlerts();
  }
  function flushAlerts() {
    clearTimeout(alertRetry);
    if (!alertQueue.length) return;
    if (!settings.voice || document.hidden) { alertQueue.length = 0; return; }
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
      // Телефон не даёт говорить, пока экран ни разу не трогали: скажем после первого касания.
      if (!alertGestureWait) {
        alertGestureWait = true;
        document.addEventListener('pointerdown', () => { alertGestureWait = false; setTimeout(flushAlerts, 350); }, { once: true, capture: true });
      }
      return;
    }
    const wait = speakingNow || recState !== 'idle' ? 1500 : Math.max(0, 6000 - (Date.now() - lastAlertAt));
    if (wait > 0) { alertRetry = setTimeout(flushAlerts, wait); return; }
    const items = alertQueue.splice(0).filter(a => Date.now() - a.at < 5 * 60e3);
    if (!items.length) return;
    lastAlertAt = Date.now();
    speak(leadSir(items.map(a => a.say).join(' ')), () => {});
  }
  function showAlertBanner(a) {
    let el = document.getElementById('poJvAlert');
    if (!el) {
      el = document.createElement('div');
      el.id = 'poJvAlert';
      el.setAttribute('role', 'alert');
      document.body.appendChild(el);
      el.addEventListener('click', e => {
        const cur = showAlertBanner.cur, btn = e.target.closest('button');
        el.hidden = true;
        if (!btn || !cur) return;
        if (cur.open) { try { window.openClient(cur.open.id); } catch (_) {} }
        else if (cur.nav) { try { window.navigate(cur.nav); } catch (_) {} }
      });
    }
    showAlertBanner.cur = a;
    // Приветствие на том же месте экрана: оповещение встаёт под него.
    const greetEl = document.getElementById('poJvGreet');
    const greetBox = greetEl && !greetEl.hidden ? greetEl.getBoundingClientRect() : null;
    el.style.top = greetBox && greetBox.height ? `${Math.round(greetBox.bottom + 8)}px` : '';
    const action = a.open ? 'Открыть' : a.nav ? 'Склад' : '';
    el.dataset.tone = a.tone;
    el.innerHTML = `<span class="jv-alert-ic" aria-hidden="true">${a.tone === 'err' ? I.err : I.warn}</span><div><b>${esc(a.title)}</b>${a.sub ? `<small>${esc(a.sub)}</small>` : ''}</div>${action ? `<button type="button">${action}</button>` : ''}`;
    el.hidden = false;
    el.classList.remove('jv-alert-in'); void el.offsetWidth; el.classList.add('jv-alert-in');
    clearTimeout(showAlertBanner.t);
    showAlertBanner.t = setTimeout(() => { el.hidden = true; }, 9000);
  }
  function alertTick() {
    if (!alertsAllowed() || (!settings.alertRooms && !settings.alertStock)) { stockSnap = null; return; }
    try { if (settings.alertRooms) checkRooms(); } catch (_) { /* оповещения не должны мешать работе */ }
    try { if (settings.alertStock) checkStock(); else stockSnap = null; } catch (_) {}
  }

  /* ---------- интерфейс ---------- */
  const I = {
    mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11.5" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2.2"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
    tune: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>',
    kbd: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M7 10h.01M10.5 10h.01M14 10h.01M17.5 10h.01M8 14h8"/></svg>',
    ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5.5 12.5 4 4 9-9.5"/></svg>',
    err: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 7.5l9 9M16.5 7.5l-9 9"/></svg>',
    warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v6.5M12 17v.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 11v6M12 7.5v.01"/></svg>'
  };
  const CSS = `
#poJvOrb{position:fixed;right:max(14px,env(safe-area-inset-right));bottom:calc(88px + env(safe-area-inset-bottom));z-index:45;width:62px;height:62px;padding:0;border-radius:50%;border:1px solid rgba(246,189,71,.72);background:radial-gradient(circle at 34% 28%,#3d2a10 0,#1a1108 48%,#0b0705 100%);color:#ffe5a1;display:grid;place-items:center;box-shadow:0 12px 30px rgba(0,0,0,.62),0 0 0 5px rgba(246,189,71,.07),inset 0 1px 0 rgba(255,229,161,.24);cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
#poJvOrb[hidden]{display:none!important}
#poJvOrb svg{width:27px;height:27px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
#poJvOrb:active{transform:scale(.94)}
#poJvOrb:focus-visible{outline:2px solid #ffd36e;outline-offset:3px}
#poJvOrb .jv-orb-name{position:absolute;left:50%;top:100%;transform:translate(-50%,4px);font:800 9.5px/1 system-ui,-apple-system,Segoe UI,sans-serif;letter-spacing:.02em;color:#e9cf8f;white-space:nowrap;text-shadow:0 1px 4px #000}
#poJvHint{position:fixed;right:calc(max(14px,env(safe-area-inset-right)) + 72px);bottom:calc(98px + env(safe-area-inset-bottom));z-index:45;max-width:220px;padding:10px 12px;border:1px solid rgba(246,189,71,.55);border-radius:14px 14px 4px 14px;background:linear-gradient(140deg,#2a1b0b,#120c07);color:#f6e7c6;font:700 12px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 10px 26px rgba(0,0,0,.55)}
#poJvHint[hidden]{display:none!important}
#poJvSheet{position:fixed;left:max(8px,env(safe-area-inset-left));right:max(8px,env(safe-area-inset-right));bottom:calc(82px + env(safe-area-inset-bottom));z-index:48;max-width:640px;margin:0 auto;max-height:min(70dvh,580px);display:flex;flex-direction:column;border:1px solid #765025;border-radius:22px;background:linear-gradient(162deg,#1e130a 0%,#0d0805 72%);box-shadow:0 -8px 34px rgba(0,0,0,.5),0 22px 54px rgba(0,0,0,.62),inset 0 1px 0 rgba(255,229,161,.07);color:#f9f2e6;font:15px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;overflow:hidden}
#poJvSheet[hidden]{display:none!important}
#poJvSheet.jv-under-modal{visibility:hidden}
#poJvSheet.jv-in-settings .jv-foot,#poJvSheet.jv-in-settings .jv-text{display:none!important}
body.po-jv-on #homeView .rooms{margin-bottom:84px}
#poJvSheet svg{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
#poJvSheet button{font:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
#poJvSheet button:focus-visible,#poJvSheet input:focus-visible{outline:2px solid #ffd36e;outline-offset:2px}
.jv-head{display:flex;align-items:center;gap:8px;padding:13px 12px 8px 16px}
.jv-title{display:flex;align-items:center;gap:9px;margin-right:auto;min-width:0}
.jv-title h2{margin:0;font:700 21px/1.1 Georgia,'Times New Roman',serif;color:#ffe5a1;letter-spacing:-.01em}
.jv-dot{width:9px;height:9px;border-radius:50%;background:#6b5a42;box-shadow:0 0 0 3px rgba(107,90,66,.18);flex:0 0 auto}
#poJvSheet[data-state="listening"] .jv-dot{background:#2df082;box-shadow:0 0 0 3px rgba(45,240,130,.2),0 0 12px #2df082}
#poJvSheet[data-state="busy"] .jv-dot{background:#f6bd47;box-shadow:0 0 0 3px rgba(246,189,71,.2)}
.jv-ctx{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:5px 9px 5px 11px;border:1px solid rgba(45,240,130,.45);border-radius:999px;background:rgba(10,42,26,.8);color:#a5f4bf;font-weight:850!important;font-size:13px!important}
.jv-ctx[hidden]{display:none}
.jv-ctx span{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;background:rgba(165,244,191,.14);font-size:12px;line-height:1}
.jv-icon{display:grid;place-items:center;width:38px;height:38px;padding:0;border:1px solid #4d351e;border-radius:12px;background:#150e08;color:#e9d3a1}
.jv-icon svg{width:19px;height:19px}
.jv-body{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:0 14px 6px}
.jv-status{margin:0 2px 6px;color:#c9b894;font-size:12.5px;font-weight:650;min-height:18px}
.jv-status.err{color:#ff8f86}.jv-status.warn{color:#f6cf74}
.jv-heard{margin:0 2px 10px;min-height:26px;font-size:19px;line-height:1.35;font-weight:700;color:#fff4dc;overflow-wrap:anywhere}
.jv-heard:empty{display:none}
.jv-heard i{font-style:normal;color:#a8977c;font-weight:600}
.jv-ask{margin:0 0 10px;padding:12px;border:1px solid rgba(246,189,71,.5);border-radius:16px;background:linear-gradient(135deg,rgba(64,44,13,.7),rgba(16,14,9,.94))}
.jv-ask h3{margin:0 0 3px;font-size:15px;font-weight:850;color:#ffdf92;line-height:1.3}
.jv-ask p{margin:0 0 9px;color:#cdbd9c;font-size:12px;font-weight:600}
.jv-chips{display:flex;flex-wrap:wrap;gap:7px}
.jv-chip{min-height:42px;padding:8px 12px;border:1px solid #7a5527;border-radius:12px;background:#1a1109;color:#ffe5a1;font-size:13.5px!important;font-weight:750!important;text-align:left;line-height:1.25}
.jv-chip small{display:block;color:#b49f7b;font-size:11px;font-weight:650}
.jv-chip.jv-num{min-width:52px;text-align:center;font-size:15px!important;font-weight:900!important}
.jv-chip.jv-go{border-color:#2f9a60;background:linear-gradient(135deg,#0f4a2b,#0a2c1b);color:#b4f7cb}
.jv-chip.jv-ghost{border-color:#4d351e;background:transparent;color:#cbb58e}
.jv-remember{display:flex;align-items:center;gap:9px;margin-top:10px;font-size:12.5px;font-weight:700;color:#e8d6ae}
.jv-remember input{width:20px;height:20px;accent-color:#f6bd47;flex:0 0 auto}
.jv-log{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.jv-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:10px;padding:9px 10px;border:1px solid #39291a;border-radius:14px;background:rgba(22,14,8,.78)}
.jv-row.jv-new{animation:jvIn .22s ease-out}
.jv-ic{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;border:1px solid #5a4630;color:#d8c3a0;background:#191109}
.jv-ic svg{width:16px;height:16px;stroke-width:2.4}
.jv-row[data-state="ok"] .jv-ic{border-color:#2df082;color:#2df082;background:#0c2e1c}
.jv-row[data-state="err"] .jv-ic{border-color:#ff554b;color:#ff7d74;background:#311210}
.jv-row[data-state="warn"] .jv-ic{border-color:#f6bd47;color:#f6bd47;background:#2f220b}
.jv-row[data-state="wait"] .jv-ic{border-color:#5a4630;border-top-color:#f6bd47;animation:jvSpin .8s linear infinite}
.jv-row[data-state="wait"] .jv-ic svg{display:none}
.jv-row b{display:block;font-size:14px;font-weight:850;color:#f9f2e6;line-height:1.25;overflow-wrap:anywhere}
.jv-row small{display:block;margin-top:2px;font-size:11.5px;color:#b2a18a;line-height:1.35;overflow-wrap:anywhere}
.jv-row.jv-done b{color:#9d8f78;text-decoration:line-through}
.jv-undo{min-height:34px;padding:6px 10px;border:1px solid #6a5130;border-radius:10px;background:#16110a;color:#f1d99f;font-size:11.5px!important;font-weight:850!important}
.jv-help{margin:4px 0 6px;padding:12px 13px;border:1px dashed #4a3520;border-radius:16px;background:rgba(14,9,6,.55)}
.jv-help h3{margin:0 0 8px;font:700 15px/1.2 Georgia,'Times New Roman',serif;color:#f2d48a}
.jv-help ul{list-style:none;margin:0;padding:0;display:grid;gap:7px}
.jv-help li{font-size:13px;color:#e8dcc2;line-height:1.35}
.jv-help q{font-weight:800;color:#fff1cf;quotes:"«" "»"}
.jv-help span{display:block;color:#a8977c;font-size:11.5px}
.jv-help[hidden]{display:none}
.jv-settings{flex:1 1 auto;min-height:0;overflow-y:auto;padding:2px 14px 10px}
.jv-settings[hidden]{display:none}
.jv-settings h3{margin:2px 0 10px;font:700 17px/1.2 Georgia,'Times New Roman',serif;color:#ffe5a1}
.jv-field{margin:0 0 14px}
.jv-field>span{display:block;margin:0 0 6px;font-size:12px;font-weight:800;color:#e5c986}
.jv-field small{display:block;margin-top:6px;font-size:11.5px;color:#a8977c;line-height:1.45}
.jv-seg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;padding:4px;border:1px solid #4d351e;border-radius:13px;background:#120c07}
.jv-seg button{min-height:38px;border:0;border-radius:10px;background:transparent;color:#cbb58e;font-size:12.5px!important;font-weight:800!important}
.jv-seg button[aria-checked="true"]{background:linear-gradient(135deg,#a86d15,#ffda6e);color:#251807}
.jv-switch{display:flex;align-items:center;gap:10px;margin:0 0 12px;font-size:13.5px;font-weight:700;color:#f0e2c3}
.jv-switch input{width:22px;height:22px;accent-color:#f6bd47;flex:0 0 auto}
.jv-learned{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.jv-learned li{display:flex;align-items:center;gap:8px;padding:7px 9px;border:1px solid #39291a;border-radius:11px;background:#150e08;font-size:12.5px;color:#eadcbf}
.jv-learned li span{flex:1;min-width:0;overflow-wrap:anywhere}
.jv-learned li button{min-height:30px;padding:4px 9px;border:1px solid #5d3a33;border-radius:9px;background:#1d0e0b;color:#ffb3aa;font-size:11px!important;font-weight:800!important}
.jv-text{display:flex;gap:8px;padding:8px 14px 0}
.jv-text[hidden]{display:none}
.jv-text input{flex:1;min-width:0;min-height:46px;padding:10px 12px;border:1px solid #624b2a;border-radius:12px;background:#fff8e9;color:#21180d;font:inherit;font-size:15px}
.jv-text button{min-height:46px;padding:0 14px;border:1px solid #e4b64f;border-radius:12px;background:linear-gradient(135deg,#a86d15,#ffda6e);color:#251807;font-weight:900!important;font-size:13px!important}
.jv-foot{display:flex;gap:8px;padding:10px 14px 12px}
.jv-kbd{display:grid;place-items:center;width:56px;height:56px;padding:0;border:1px solid #5d482a;border-radius:16px;background:#15100a;color:#e9d3a1;flex:0 0 auto}
.jv-kbd[aria-pressed="true"]{border-color:#e4b64f;color:#ffe5a1;background:#2a1d0c}
.jv-kbd svg{width:24px;height:24px}
.jv-mic{position:relative;flex:1;display:flex;align-items:center;justify-content:center;gap:10px;height:56px;border:1px solid #e4b64f;border-radius:16px;background:linear-gradient(135deg,#a86d15,#ffda6e);color:#251807;font-weight:900!important;font-size:16px!important;letter-spacing:.01em;box-shadow:0 8px 20px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.35)}
.jv-mic svg{width:24px;height:24px;stroke-width:2}
#poJvSheet[data-state="listening"] .jv-mic{border-color:#5cf59f;background:linear-gradient(135deg,#0e5a33,#25d375);color:#04170c;animation:jvPulse 1.5s ease-out infinite}
#poJvSheet[data-state="busy"] .jv-mic{opacity:.85}
.jv-card{list-style:none;padding:13px 13px 12px;border:1px solid #5a4127;border-radius:16px;background:linear-gradient(160deg,rgba(40,27,12,.92),rgba(14,10,6,.96));box-shadow:inset 0 1px 0 rgba(255,229,161,.05)}
.jv-card.jv-new{animation:jvIn .22s ease-out}
.jv-card[data-tone="warn"]{border-color:rgba(246,189,71,.55)}
.jv-card[data-tone="err"]{border-color:rgba(255,85,75,.55)}
.jv-card h4{margin:0 0 5px;font:700 15px/1.25 Georgia,'Times New Roman',serif;color:#f2d48a}
.jv-big{font-size:28px;font-weight:900;color:#ffe5a1;line-height:1.1;letter-spacing:-.01em;overflow-wrap:anywhere}
.jv-big small{display:block;margin-top:4px;font-size:12px;font-weight:650;color:#b9a684;letter-spacing:0}
.jv-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:10px 0 0}
.jv-stats div{padding:7px 9px;border:1px solid #3a2a18;border-radius:11px;background:rgba(10,7,4,.55);min-width:0}
.jv-stats dt{font-size:10.5px;color:#a8977c;font-weight:700;line-height:1.25}
.jv-stats dd{margin:2px 0 0;font-size:14px;font-weight:850;color:#f9f2e6;overflow-wrap:anywhere}
.jv-stats .warn dd{color:#f6cf74}.jv-stats .err dd{color:#ff8f86}.jv-stats .ok dd{color:#7ff0ad}
.jv-steps{margin:8px 0 0;padding-left:21px;display:grid;gap:6px;font-size:13.5px;color:#eadcbf;line-height:1.42}
.jv-steps li::marker{color:#f6bd47;font-weight:900}
.jv-list{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:5px}
.jv-list li>div,.jv-list li>button{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:1px solid #33251a;border-radius:11px;background:rgba(12,8,5,.6);color:inherit;text-align:left;font:inherit}
.jv-list li>button:active{background:rgba(40,28,12,.8)}
.jv-list span{min-width:0}
.jv-list b{display:block;font-size:13.5px;font-weight:800;color:#f9f2e6;overflow-wrap:anywhere;line-height:1.3}
.jv-list small{display:block;margin-top:2px;font-size:11.5px;color:#a8977c;overflow-wrap:anywhere;line-height:1.35}
.jv-list em{font-style:normal;font-size:13.5px;font-weight:850;color:#ffe5a1;white-space:nowrap;flex:0 0 auto}
.jv-list li.warn em{color:#f6cf74}.jv-list li.err em{color:#ff8f86}.jv-list li.err>*{border-color:rgba(255,85,75,.38)}
.jv-card-note{margin:8px 0 0;font-size:12.5px;color:#cdbd9c;line-height:1.45}
.jv-card-chips{margin-top:10px}
.jv-card-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:11px}
.jv-btn{min-height:40px;padding:8px 13px;border:1px solid #6a5130;border-radius:12px;background:#17110a;color:#f1d99f;font-size:13px!important;font-weight:850!important}
.jv-btn-main{border-color:#e4b64f;background:linear-gradient(135deg,#a86d15,#ffda6e);color:#251807}
#poJvGreet{position:fixed;left:50%;top:calc(78px + env(safe-area-inset-top));transform:translateX(-50%);z-index:60;display:flex;align-items:center;gap:12px;width:min(92vw,460px);padding:12px 15px 12px 12px;border:1px solid rgba(246,189,71,.6);border-radius:18px;background:linear-gradient(150deg,#2b1c0b,#0f0a06);color:#f9f2e6;box-shadow:0 18px 44px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,229,161,.1);font:15px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;cursor:pointer}
#poJvGreet[hidden]{display:none!important}
#poJvGreet b{display:block;font:700 16px/1.25 Georgia,'Times New Roman',serif;color:#ffe5a1}
#poJvGreet small{display:block;margin-top:3px;font-size:12px;color:#c9b894;font-weight:650}
.jv-greet-orb{flex:0 0 auto;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(246,189,71,.7);background:radial-gradient(circle at 34% 28%,#3d2a10,#0b0705);color:#ffe5a1;box-shadow:0 0 0 4px rgba(45,240,130,.12),0 0 18px rgba(45,240,130,.25)}
.jv-greet-orb svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
#poJvGreet.jv-greet-in{animation:jvGreet .5s cubic-bezier(.16,1,.3,1)}
@keyframes jvGreet{from{opacity:0;transform:translate(-50%,-10px)}to{opacity:1;transform:translate(-50%,0)}}
.jv-chip[aria-checked="true"]{border-color:#e4b64f;background:linear-gradient(135deg,rgba(168,109,21,.5),rgba(255,218,110,.16));color:#fff1cf;box-shadow:inset 0 0 0 1px rgba(255,218,110,.3)}
.jv-tag{display:inline-block;margin-left:6px;padding:1px 6px;border:1px solid rgba(45,240,130,.45);border-radius:999px;color:#a5f4bf;font-size:10px;font-weight:800;vertical-align:1px}
.jv-vstat{margin:0 0 10px;padding:10px 12px;border:1px solid #4d351e;border-radius:13px;background:#120c07;font-size:12.5px;line-height:1.45;color:#d9cba9}
.jv-vstat.ok{border-color:rgba(45,240,130,.45);background:rgba(10,42,26,.55);color:#c9f7da}
.jv-vstat b{display:block;margin-bottom:2px;font-size:13px;color:#fff1cf}
.jv-field>span em{font-style:normal;color:#fff1cf;font-weight:900;margin-left:4px}
.jv-range{display:block;width:100%;height:30px;margin:0;accent-color:#f6bd47}
.jv-preview{display:flex;align-items:center;gap:8px;margin:0 0 16px}
.jv-preview svg{width:16px;height:16px}
#poJvAlert{position:fixed;left:50%;top:calc(78px + env(safe-area-inset-top));transform:translateX(-50%);z-index:61;display:flex;align-items:center;gap:11px;width:min(92vw,470px);padding:11px 12px 11px 11px;border:1px solid rgba(246,189,71,.72);border-radius:18px;background:linear-gradient(150deg,#2f210b,#100b06);color:#f9f2e6;box-shadow:0 18px 44px rgba(0,0,0,.62),inset 0 1px 0 rgba(255,229,161,.08)}
#poJvAlert[data-tone="err"]{border-color:rgba(255,85,75,.75);background:linear-gradient(150deg,#3a130f,#120806)}
#poJvAlert[hidden]{display:none!important}
#poJvAlert>div{flex:1;min-width:0}
#poJvAlert b{display:block;font-size:14.5px;font-weight:850;line-height:1.25;color:#ffe5a1;overflow-wrap:anywhere}
#poJvAlert[data-tone="err"] b{color:#ffc2bb}
#poJvAlert small{display:block;margin-top:2px;font-size:12px;font-weight:650;line-height:1.35;color:#d6c6a5;overflow-wrap:anywhere}
#poJvAlert button{flex:0 0 auto;min-height:40px;padding:6px 12px;border:1px solid #e4b64f;border-radius:12px;background:linear-gradient(135deg,#a86d15,#ffda6e);color:#251807;font:inherit;font-size:13px;font-weight:900;cursor:pointer}
.jv-alert-ic{flex:0 0 auto;display:grid;place-items:center;width:38px;height:38px;border:1px solid #f6bd47;border-radius:50%;background:#2f220b;color:#f6bd47}
#poJvAlert[data-tone="err"] .jv-alert-ic{border-color:#ff554b;background:#311210;color:#ff7d74}
.jv-alert-ic svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
#poJvAlert.jv-alert-in{animation:jvGreet .45s cubic-bezier(.16,1,.3,1)}
#roomsGrid .room.po-jv-flash{box-shadow:0 0 0 2px #2df082,0 0 26px rgba(45,240,130,.42)!important;transition:box-shadow .2s ease}
@keyframes jvSpin{to{transform:rotate(360deg)}}
@keyframes jvIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes jvPulse{0%{box-shadow:0 0 0 0 rgba(45,240,130,.55),0 8px 20px rgba(0,0,0,.35)}100%{box-shadow:0 0 0 14px rgba(45,240,130,0),0 8px 20px rgba(0,0,0,.35)}}
@media (prefers-reduced-motion:reduce){#poJvSheet *,#poJvGreet,#poJvAlert{animation:none!important;transition:none!important}.jv-row[data-state="wait"] .jv-ic{border-top-color:#f6bd47}}
body.po-jv-nonav #poJvOrb{bottom:28px;right:28px}
body.po-jv-nonav #poJvHint{bottom:40px;right:104px}
body.po-jv-nonav #poJvSheet{left:auto;right:24px;bottom:24px;width:min(520px,calc(100vw - 48px));margin:0;max-height:min(78dvh,640px)}
`;

  let orb, hint, sheet, $status, $heard, $ask, $log, $help, $settings, $text, $input, $ctx, $mic, $kbd;
  const q = sel => sheet.querySelector(sel);

  function buildUi() {
    const style = document.createElement('style');
    style.id = 'po-jarvis-v1-style';
    style.textContent = CSS;
    document.head.appendChild(style);

    orb = document.createElement('button');
    orb.id = 'poJvOrb';
    orb.type = 'button';
    orb.hidden = true;
    orb.setAttribute('aria-label', 'Джарвис: голосовые команды');
    orb.innerHTML = I.mic + '<span class="jv-orb-name" aria-hidden="true">Джарвис</span>';

    hint = document.createElement('div');
    hint.id = 'poJvHint';
    hint.hidden = true;
    hint.textContent = 'Нажмите и скажите: «1 браслет активный кыл» или «Бирге жарма кош»';

    sheet = document.createElement('section');
    sheet.id = 'poJvSheet';
    sheet.hidden = true;
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'Джарвис — голосовые команды');
    sheet.dataset.state = 'idle';
    sheet.innerHTML = `
      <header class="jv-head">
        <div class="jv-title"><span class="jv-dot" aria-hidden="true"></span><h2>Джарвис</h2></div>
        <button type="button" class="jv-ctx" data-jv-ctx hidden aria-label="Сбросить выбранный браслет"><b></b><span aria-hidden="true">×</span></button>
        <button type="button" class="jv-icon" data-jv-tune aria-label="Настройки Джарвиса">${I.tune}</button>
        <button type="button" class="jv-icon" data-jv-close aria-label="Закрыть Джарвиса">${I.close}</button>
      </header>
      <div class="jv-body" data-jv-body>
        <p class="jv-status" data-jv-status aria-live="polite">Нажмите «Говорить» и скажите команду</p>
        <p class="jv-heard" data-jv-heard></p>
        <div data-jv-ask aria-live="polite"></div>
        <ol class="jv-log" data-jv-log aria-live="polite"></ol>
        <div class="jv-help" data-jv-help>
          <h3>Как говорить</h3>
          <ul>
            <li><q>3 браслет активный кыл</q><span>выдать браслет №3</span></li>
            <li><q>Бирге жарма кош</q><span>или «1 браслетке 2 жарма», «вход взрослый кош»</span></li>
            <li><q>Сводка</q><span>смена, касса, браслеты и склад одной фразой</span></li>
            <li><q>Что на 5 браслете?</q><span>или «сколько осталось жармы», «найди клиента Азамат»</span></li>
            <li><q>Открой склад</q><span>любой раздел сайта; «как закрыть смену» — подсказка</span></li>
            <li><q>Что ты умеешь?</q><span>все возможности Джарвиса</span></li>
          </ul>
        </div>
      </div>
      <div class="jv-settings" data-jv-settings hidden></div>
      <form class="jv-text" data-jv-text hidden autocomplete="off">
        <input type="text" data-jv-input inputmode="text" enterkeyhint="send" placeholder="Например: 1 жарма" aria-label="Команда текстом">
        <button type="submit">Выполнить</button>
      </form>
      <footer class="jv-foot">
        <button type="button" class="jv-kbd" data-jv-kbd aria-pressed="false" aria-label="Написать команду текстом">${I.kbd}</button>
        <button type="button" class="jv-mic" data-jv-mic>${I.mic}<span>Говорить</span></button>
      </footer>`;
    document.body.append(orb, hint, sheet);
    $status = q('[data-jv-status]'); $heard = q('[data-jv-heard]'); $ask = q('[data-jv-ask]'); $log = q('[data-jv-log]');
    $help = q('[data-jv-help]'); $settings = q('[data-jv-settings]'); $text = q('[data-jv-text]'); $input = q('[data-jv-input]');
    $ctx = q('[data-jv-ctx]'); $mic = q('[data-jv-mic]'); $kbd = q('[data-jv-kbd]');

    orb.addEventListener('click', () => { openSheet(); startListening(); });
    q('[data-jv-close]').addEventListener('click', () => closeSheet());
    q('[data-jv-tune]').addEventListener('click', () => toggleSettings());
    $ctx.addEventListener('click', () => { clearCtx(); setStatus('Браслет сброшен. Назовите номер в команде.'); });
    $mic.addEventListener('click', () => { if (recState === 'listening') stopListening(); else if (recState === 'idle') startListening(); });
    $kbd.addEventListener('click', () => showText($text.hidden));
    $text.addEventListener('submit', e => { e.preventDefault(); const v = $input.value; $input.value = ''; handleText(v); });
    sheet.addEventListener('click', onSheetClick);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetOpen) closeSheet(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { abortListening(); cancelSpeech(); } });
    try { if ('speechSynthesis' in window) { loadVoices(); window.speechSynthesis.onvoiceschanged = () => { loadVoices(); if (!$settings.hidden) renderSettings(); }; } } catch (_) {}
  }

  function onSheetClick(e) {
    const t = e.target.closest('button');
    if (!t || !sheet.contains(t)) return;
    if (t.dataset.jvUndo) {
      const row = rows.find(r => String(r.id) === t.dataset.jvUndo);
      if (row && row.undo) { const record = row.undo; row.undo = null; renderRows(); const batch = newBatch(''); enqueue(batch, b => undoRecord(record, b)); closeBatch(batch); }
      return;
    }
    if (t.dataset.jvAct) {
      const [rid, idx] = t.dataset.jvAct.split(':');
      const row = rows.find(r => String(r.id) === rid);
      const fn = row && row.card && row.card.acts[Number(idx)];
      if (typeof fn === 'function') fn();
      return;
    }
    if (t.dataset.jvPick) { resolveProduct(t.dataset.jvPick); return; }
    if (t.dataset.jvRoom) { resolveRoom(Number(t.dataset.jvRoom)); return; }
    if (t.dataset.jvYes != null) { resolveYes(); return; }
    if (t.dataset.jvCancel != null) { cancelPending(); return; }
    if (t.dataset.jvLang) { settings.lang = t.dataset.jvLang; saveSettings(); renderSettings(); return; }
    if (t.dataset.jvAddress) { settings.address = t.dataset.jvAddress; saveSettings(); renderSettings(); return; }
    if (t.dataset.jvForget) { delete learned[t.dataset.jvForget]; saveLearned(); indexCache.sig = ''; renderSettings(); return; }
    if (t.dataset.jvSv) { settings.serverVoice = t.dataset.jvSv; settings.serverVoiceOn = true; serverBrokenUntil = 0; saveSettings(); renderSettings(); previewVoice(false); return; }
    if (t.dataset.jvDv != null) { settings.voiceName = t.dataset.jvDv; saveSettings(); renderSettings(); previewVoice(true); return; }
    if (t.dataset.jvPreview != null) { previewVoice(false); return; }
    if (t.dataset.jvBack != null) { toggleSettings(false); return; }
  }

  function openSheet() {
    sheetOpen = true;
    sheet.hidden = false;
    orb.hidden = true;
    hint.hidden = true;
    if (!settings.hintShown) { settings.hintShown = true; saveSettings(); }
    renderCtx();
    renderRows();
  }
  function closeSheet() {
    abortListening();
    cancelSpeech();
    sheetOpen = false;
    sheet.hidden = true;
    toggleSettings(false);
    updateVisibility();
  }
  function toggleSettings(force) {
    const show = typeof force === 'boolean' ? force : $settings.hidden;
    $settings.hidden = !show;
    q('[data-jv-body]').hidden = show;
    sheet.classList.toggle('jv-in-settings', show);
    if (show) {
      renderSettings();
      refreshFeatures(true).then(() => { if (!$settings.hidden) renderSettings(); });
    }
  }
  function showText(show) {
    $text.hidden = !show;
    $kbd.setAttribute('aria-pressed', String(!!show));
    if (show) setTimeout(() => { try { $input.focus(); } catch (_) {} }, 30);
  }
  function setMic(state) {
    recState = state;
    if (!sheet) return;
    sheet.dataset.state = state;
    const label = $mic.querySelector('span');
    if (state === 'listening') { $mic.innerHTML = I.stop + '<span>Слушаю… нажмите, чтобы закончить</span>'; }
    else if (state === 'busy') { $mic.innerHTML = I.mic + '<span>Понимаю…</span>'; }
    else if (!label || label.textContent !== 'Говорить') { $mic.innerHTML = I.mic + '<span>Говорить</span>'; }
  }
  function setStatus(text, kind) {
    if (!$status) return;
    $status.textContent = text || '';
    $status.className = 'jv-status' + (kind ? ' ' + kind : '');
  }
  function setHeard(done, live) {
    if (!$heard) return;
    $heard.innerHTML = done || live ? `${esc(done)}${live ? ` <i>${esc(live)}</i>` : ''}` : '';
  }
  function renderCtx() {
    if (!$ctx) return;
    const room = ctxRoom();
    $ctx.hidden = !room;
    if (room) $ctx.querySelector('b').textContent = `Браслет №${room}`;
  }

  function addRow(r) {
    const row = Object.assign({ id: ++rowSeq, state: 'info', title: '', meta: '', undo: null, fresh: true }, r);
    rows.unshift(row);
    while (rows.length > MAX_ROWS) rows.pop();
    renderRows();
    return row;
  }
  function updateRow(row, patch) {
    Object.assign(row, patch, { fresh: false });
    renderRows();
  }
  function renderCard(r) {
    const c = r.card;
    const act = i => `data-jv-act="${r.id}:${i}"`;
    return `<li class="jv-card${r.fresh ? ' jv-new' : ''}" data-tone="${esc(c.tone || 'info')}">
      <h4>${esc(c.title)}</h4>
      ${c.big ? `<div class="jv-big">${esc(c.big)}${c.bigNote ? `<small>${esc(c.bigNote)}</small>` : ''}</div>` : (c.bigNote ? `<p class="jv-card-note">${esc(c.bigNote)}</p>` : '')}
      ${c.stats.length ? `<dl class="jv-stats">${c.stats.map(x => `<div class="${esc(x.cls)}"><dt>${esc(x.l)}</dt><dd>${esc(x.v)}</dd></div>`).join('')}</dl>` : ''}
      ${c.steps.length ? `<ol class="jv-steps">${c.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
      ${c.list.length ? `<ul class="jv-list">${c.list.map(x => `<li class="${esc(x.cls)}">${x.act >= 0 ? `<button type="button" ${act(x.act)}>` : '<div>'}<span><b>${esc(x.l)}</b>${x.m ? `<small>${esc(x.m)}</small>` : ''}</span>${x.r ? `<em>${esc(x.r)}</em>` : ''}${x.act >= 0 ? '</button>' : '</div>'}</li>`).join('')}</ul>` : ''}
      ${c.note ? `<p class="jv-card-note">${esc(c.note)}</p>` : ''}
      ${c.chips.length ? `<div class="jv-chips jv-card-chips">${c.chips.map(x => `<button type="button" class="jv-chip${x.cls === 'num' ? ' jv-num' : ''}" ${act(x.act)}>${esc(x.label)}</button>`).join('')}</div>` : ''}
      ${c.buttons.length ? `<div class="jv-card-actions">${c.buttons.map(x => `<button type="button" class="${x.primary ? 'jv-btn jv-btn-main' : 'jv-btn'}" ${act(x.act)}>${esc(x.label)}</button>`).join('')}</div>` : ''}
    </li>`;
  }
  function renderRows() {
    if (!$log) return;
    $log.innerHTML = rows.map(r => r.kind === 'card' ? renderCard(r) : `
      <li class="jv-row${r.fresh ? ' jv-new' : ''}${r.undone ? ' jv-done' : ''}" data-state="${r.state}">
        <span class="jv-ic">${I[r.state] || I.info}</span>
        <div><b>${esc(r.title)}</b>${r.meta ? `<small>${esc(r.meta)}</small>` : ''}</div>
        ${r.undo && history.includes(r.undo) ? `<button type="button" class="jv-undo" data-jv-undo="${r.id}">Отменить</button>` : '<span></span>'}
      </li>`).join('');
    rows.forEach(r => { r.fresh = false; });
    $help.hidden = rows.length > 0 || !!pending;
  }

  function optionLabel(ref) {
    const it = itemOf(ref);
    if (!it) return esc(ref);
    if (it.kind === 'entry') return esc(it.name);
    const p = productOf(it);
    const price = p && p.price != null ? money(p.price) : 'нет цены';
    const left = p ? Math.max(0, Number(p.available ?? (Number(p.stock || 0) - Number(p.reserved || 0)))) : 0;
    return `${esc(it.name)}${it.tag ? ' · ' + esc(it.tag) : ''}<small>${price} · остаток ${left}</small>`;
  }
  function roomChips(free) {
    const list = [];
    for (let n = 1; n <= 36; n++) { const c = clientOf(n); if (free ? !c : !!c) list.push({ n, c }); }
    return list;
  }
  function renderAsk() {
    if (!$ask) return;
    const p = pending;
    if (!p) { $ask.innerHTML = ''; renderRows(); return; }
    let html = '';
    if (p.kind === 'product' && !p.guess && p.options.length > 1 && new Set(p.options.map(baseName)).size === 1) {
      const where = p.room != null ? ` → №${p.room}` : (ctxRoom() ? ` → №${ctxRoom()}` : '');
      const first = itemOf(p.options[0]);
      const base = first ? String(first.name).replace(/\s*[—–-]\s*размер\s+\S+$/i, '').replace(/\s*\|\s*\S+$/, '').trim() : p.text;
      html = `<h3>${esc(base)}${p.qty > 1 ? ' ×' + p.qty : ''} — какой размер?${esc(where)}</h3><p>Скажите размер («эм», «икс эль») или нажмите.</p>
        <div class="jv-chips">${p.options.map(ref => { const it = itemOf(ref); const prod = productOf(it); const left = prod ? Math.max(0, Number(prod.available ?? (Number(prod.stock || 0) - Number(prod.reserved || 0)))) : 0;
          const size = it ? (String(it.name).match(/размер\s+(\S+)$/i) || String(it.name).match(/\|\s*(\S+)$/) || [, it.name])[1] : ref;
          return `<button type="button" class="jv-chip jv-num" data-jv-pick="${esc(ref)}">${esc(size)}<small>ост. ${left}</small></button>`; }).join('')}
        <button type="button" class="jv-chip jv-ghost" data-jv-cancel>Отмена</button></div>`;
    } else if (p.kind === 'product') {
      const where = p.room != null ? ` → №${p.room}` : (ctxRoom() ? ` → №${ctxRoom()}` : '');
      html = `<h3>${p.guess ? 'Возможно, вы имели в виду' : 'Какой именно?'} «${esc(p.text)}»${p.qty > 1 ? ' ×' + p.qty : ''}${esc(where)}</h3>
        <p>Нажмите нужный товар или скажите его точнее.</p>
        <div class="jv-chips">${p.options.map(ref => `<button type="button" class="jv-chip" data-jv-pick="${esc(ref)}">${optionLabel(ref)}</button>`).join('')}
        <button type="button" class="jv-chip jv-ghost" data-jv-cancel>Отмена</button></div>
        ${willLearn(p) && p.phrase ? `<label class="jv-remember"><input type="checkbox" data-jv-remember ${p.remember ? 'checked' : ''}><span>Запомнить: «${esc(p.text)}» — это мой выбор</span></label>` : ''}`;
    } else if (p.kind === 'room') {
      const active = roomChips(false);
      const names = p.items.map(it => { const x = itemOf(it.ref); return x ? x.name + (it.qty > 1 ? ' ×' + it.qty : '') : ''; }).filter(Boolean).join(', ');
      html = `<h3>На какой браслет${p.remove ? ' убрать' : ''}?</h3><p>${esc(names)} — скажите номер или нажмите.</p>
        <div class="jv-chips">${active.length ? active.map(({ n, c }) => `<button type="button" class="jv-chip jv-num" data-jv-room="${n}">№${n}<small>Кл. ${esc(clientNo(c))}</small></button>`).join('') : '<p>Нет активных браслетов.</p>'}
        <button type="button" class="jv-chip jv-ghost" data-jv-cancel>Отмена</button></div>`;
    } else if (p.kind === 'activateRoom') {
      const free = roomChips(true);
      html = `<h3>Какой браслет активировать?</h3><p>Скажите номер или нажмите свободный.</p>
        <div class="jv-chips">${free.map(({ n }) => `<button type="button" class="jv-chip jv-num" data-jv-room="${n}">${n}</button>`).join('')}
        <button type="button" class="jv-chip jv-ghost" data-jv-cancel>Отмена</button></div>`;
    } else if (p.kind === 'inactive') {
      const names = p.items.map(it => { const x = itemOf(it.ref); return x ? x.name + (it.qty > 1 ? ' ×' + it.qty : '') : ''; }).filter(Boolean).join(', ');
      html = `<h3>Браслет №${p.room} не активен</h3><p>${esc(names)}</p>
        <div class="jv-chips"><button type="button" class="jv-chip jv-go" data-jv-yes>Активировать №${p.room} и добавить</button>
        <button type="button" class="jv-chip jv-ghost" data-jv-cancel>Отмена</button></div>`;
    } else if (p.kind === 'openShift') {
      html = `<h3>Открыть новую смену?</h3><p>Новые клиенты и оплаты пойдут в новый отчёт.</p>
        <div class="jv-chips"><button type="button" class="jv-chip jv-go" data-jv-yes>Да, открыть смену</button>
        <button type="button" class="jv-chip jv-ghost" data-jv-cancel>Отмена</button></div>`;
    } else if (p.kind === 'confirmQty') {
      const names = p.items.map(it => { const x = itemOf(it.ref); return x ? `${x.name} ×${it.qty}` : ''; }).filter(Boolean).join(', ');
      html = `<h3>Добавить так много?</h3><p>№${p.room}: ${esc(names)}</p>
        <div class="jv-chips"><button type="button" class="jv-chip jv-go" data-jv-yes>Да, добавить</button>
        <button type="button" class="jv-chip jv-ghost" data-jv-cancel>Отмена</button></div>`;
    }
    $ask.innerHTML = `<div class="jv-ask">${html}</div>`;
    const remember = $ask.querySelector('[data-jv-remember]');
    if (remember) remember.addEventListener('change', () => { if (pending) pending.remember = remember.checked; });
    renderRows();
  }

  const voiceLabel = v => String(v.name || '').replace(/^Microsoft\s+/i, '').replace(/\s*Online\s*\(Natural\)/i, '').replace(/\s*[-–]\s*Russian.*$/i, '').trim() || 'Голос';
  const previewText = () => `${withSir('Слушаю')} Браслет пять: ${sayMoney(2345)}.`;
  function previewVoice(device) {
    if (device) { cancelSpeech(); deviceSpeak(previewText(), () => {}); return; }
    speak(previewText(), () => {});
  }
  function renderSettings() {
    if (!$settings) return;
    const entries = Object.entries(learned);
    if (!ruVoices.length) loadVoices();
    const live = serverHas('jarvis-tts');
    const broken = Date.now() <= serverBrokenUntil;
    const status = live && settings.serverVoiceOn && !broken
      ? '<div class="jv-vstat ok"><b>Живой голос Джарвиса подключён</b>Мужской голос с сервера — одинаковый на всех телефонах.</div>'
      : live && broken ? `<div class="jv-vstat"><b>Живой голос временно недоступен</b>${esc(serverError)}. Пока говорит голос телефона.</div>`
        : live ? '<div class="jv-vstat"><b>Живой голос выключен</b>Сейчас говорит голос телефона.</div>'
          : '<div class="jv-vstat"><b>Сейчас говорит голос телефона</b>Живой мужской голос включается на сервере: дополнение Worker V10.20 и ключ Google. Смотрите инструкцию.</div>';
    const devList = ruVoices.slice(0, 12);
    $settings.innerHTML = `
      <h3>Настройки Джарвиса</h3>
      <label class="jv-switch"><input type="checkbox" data-jv-voice ${settings.voice ? 'checked' : ''}><span>Отвечать голосом</span></label>
      <div class="jv-field"><span>Голос Джарвиса</span>
        ${status}
        ${live ? `<label class="jv-switch"><input type="checkbox" data-jv-server ${settings.serverVoiceOn ? 'checked' : ''}><span>Живой голос с сервера</span></label>
        <div class="jv-chips" role="radiogroup" aria-label="Живой голос">${SERVER_VOICES.map(([id, name, note]) => `<button type="button" class="jv-chip" role="radio" aria-checked="${settings.serverVoice === id}" data-jv-sv="${esc(id)}">${esc(name)}<small>${esc(note)}</small></button>`).join('')}</div>` : ''}
      </div>
      <div class="jv-field"><span>Голос телефона${live && settings.serverVoiceOn ? ' · запасной' : ''}</span>
        ${devList.length > 1 ? `<div class="jv-chips" role="radiogroup" aria-label="Голос телефона">
          <button type="button" class="jv-chip" role="radio" aria-checked="${!settings.voiceName}" data-jv-dv="">Авто<small>мужской, если есть</small></button>
          ${devList.map(v => `<button type="button" class="jv-chip" role="radio" aria-checked="${settings.voiceName === v.name}" data-jv-dv="${esc(v.name)}">${esc(voiceLabel(v))}${isMaleVoice(v) ? '<span class="jv-tag">муж.</span>' : ''}</button>`).join('')}</div>` : ''}
        <small>Android: мужской голос выбирается в телефоне — Настройки → «Синтез речи» (Text-to-speech) → Google → ⚙ → «Установка голосовых данных» → Русский → выберите мужской голос.</small>
      </div>
      <div class="jv-field"><span>Скорость речи <em data-jv-rate-v>${rateOf().toFixed(2)}</em></span>
        <input class="jv-range" type="range" min="0.8" max="1.5" step="0.05" value="${rateOf()}" data-jv-rate aria-label="Скорость речи">
      </div>
      <div class="jv-field"><span>Тон голоса телефона <em data-jv-pitch-v>${pitchOf().toFixed(2)}</em></span>
        <input class="jv-range" type="range" min="0.5" max="1.3" step="0.05" value="${pitchOf()}" data-jv-pitch aria-label="Тон голоса телефона">
        <small>Меньше — ниже и глубже голос.</small>
      </div>
      <div class="jv-preview"><button type="button" class="jv-chip jv-go" data-jv-preview>${I.mic}Прослушать</button><small>«${esc(previewText())}»</small></div>
      <label class="jv-switch"><input type="checkbox" data-jv-round ${settings.roundTotals ? 'checked' : ''}><span>Итоги от 10 000 — до тысяч («двадцать четыре тысячи»)</span></label>
      <div class="jv-field"><span>Джарвис предупреждает сам</span>
        <label class="jv-switch"><input type="checkbox" data-jv-al-rooms ${settings.alertRooms ? 'checked' : ''}><span>Браслет: 2:50 — скоро 3 часа, 3:00 — время вышло</span></label>
        <label class="jv-switch"><input type="checkbox" data-jv-al-stock ${settings.alertStock ? 'checked' : ''}><span>Склад: осталось 2 шт. и товар закончился</span></label>
        <small>Только у персонала и администратора, при открытой смене. Браслет №3 руководителя не объявляется.</small>
      </div>
      <div class="jv-field"><span>Язык распознавания</span>
        <div class="jv-seg" role="radiogroup" aria-label="Язык распознавания">${LANGS.map(([code, name]) => `<button type="button" role="radio" aria-checked="${settings.lang === code}" data-jv-lang="${code}">${name}</button>`).join('')}</div>
        <small>Если кыргызский не распознаётся на телефоне, выберите русский: Джарвис понимает «кош», «бир», «эки», «биринчи» и в русском режиме. Казахский близок к кыргызскому.</small>
      </div>
      <label class="jv-switch"><input type="checkbox" data-jv-greet ${settings.greet ? 'checked' : ''}><span>Приветствие при входе на сайт</span></label>
      <div class="jv-field"><span>Обращение</span>
        <div class="jv-seg" role="radiogroup" aria-label="Обращение">${[['sir', 'Сэр'], ['madam', 'Госпожа'], ['none', 'Без обращения']].map(([code, name]) => `<button type="button" role="radio" aria-checked="${settings.address === code}" data-jv-address="${code}">${name}</button>`).join('')}</div>
      </div>
      <label class="jv-switch"><input type="checkbox" data-jv-auto ${settings.autoListen ? 'checked' : ''}><span>После ответа сразу слушать следующую команду</span></label>
      <div class="jv-field"><span>Выученные слова · ${entries.length}</span>
        ${entries.length ? `<ul class="jv-learned">${entries.map(([phrase, ref]) => { const it = itemOf(ref); return `<li><span>«${esc(phrase)}» → ${esc(it ? it.name : ref)}</span><button type="button" data-jv-forget="${esc(phrase)}">Забыть</button></li>`; }).join('')}</ul>`
          : '<small>Если Джарвис не понял слово, выберите товар с галочкой «Запомнить» — в следующий раз он поймёт сразу. Слова хранятся на этом телефоне.</small>'}
      </div>
      <button type="button" class="jv-chip jv-go" data-jv-back>Готово</button>`;
    const box = sel => $settings.querySelector(sel);
    const bind = (sel, key, after) => { const el = box(sel); if (el) el.addEventListener('change', () => { settings[key] = el.checked; saveSettings(); if (after) after(el.checked); }); };
    bind('[data-jv-voice]', 'voice', on => { if (!on) cancelSpeech(); });
    bind('[data-jv-greet]', 'greet');
    bind('[data-jv-auto]', 'autoListen');
    bind('[data-jv-server]', 'serverVoiceOn', () => renderSettings());
    bind('[data-jv-round]', 'roundTotals');
    bind('[data-jv-al-rooms]', 'alertRooms');
    bind('[data-jv-al-stock]', 'alertStock', on => { if (!on) stockSnap = null; });
    const range = (sel, label, key, read, device) => {
      const el = box(sel), out = box(label);
      if (!el) return;
      el.addEventListener('input', () => { settings[key] = Number(el.value); out.textContent = read().toFixed(2); });
      el.addEventListener('change', () => { settings[key] = Number(el.value); saveSettings(); previewVoice(device); });
    };
    range('[data-jv-rate]', '[data-jv-rate-v]', 'rate', rateOf, false);
    range('[data-jv-pitch]', '[data-jv-pitch-v]', 'pitch', pitchOf, true);
  }

  function flash(n) {
    requestAnimationFrame(() => {
      const card = Array.from(document.querySelectorAll('#roomsGrid .room')).find(r => {
        const num = r.querySelector('.band-number-overlay');
        return num && num.textContent.trim() === String(n);
      });
      if (!card) return;
      card.classList.remove('po-jv-flash');
      void card.offsetWidth;
      card.classList.add('po-jv-flash');
      setTimeout(() => card.classList.remove('po-jv-flash'), 1700);
    });
  }

  function updateVisibility() {
    if (!orb) return;
    const app = document.getElementById('appView');
    const allowed = !!app && !app.classList.contains('hidden') && ['admin', 'staff', 'manager'].includes(role());
    const modal = !!document.querySelector('.modal.open, .drawer.open, #poCeoOverlay.open, #poInlineDailyReportModal.open');
    orb.hidden = !allowed || modal || sheetOpen;
    try { checkGreeting(); } catch (e) { /* greeting is optional */ }
    document.body.classList.toggle('po-jv-on', allowed);
    const nav = document.querySelector('.bottom-nav');
    document.body.classList.toggle('po-jv-nonav', !nav || getComputedStyle(nav).display === 'none');
    if (!settings.hintShown && !orb.hidden && hint.hidden && !hint.dataset.shown) {
      hint.dataset.shown = '1';
      if (!canWrite() || portalOn()) hint.textContent = 'Нажмите и спросите: «Сводка», «Прибыль за месяц», «Отчёт за вчера»';
      hint.hidden = false;
      setTimeout(() => { hint.hidden = true; settings.hintShown = true; saveSettings(); }, 7000);
    }
    if (orb.hidden && !hint.hidden) hint.hidden = true;
    if (sheetOpen && !allowed) closeSheet();
    sheet.classList.toggle('jv-under-modal', sheetOpen && modal);
  }

  /* ---------- запуск ---------- */
  function ready() {
    return typeof db !== 'undefined' && typeof window.addPurchase === 'function' && typeof window.activateRoom === 'function'
      && typeof window.changeQty === 'function' && typeof window.openClient === 'function';
  }
  function install() {
    if (window.PARORDOJarvis) return true;
    if (!document.body || !ready()) return false;
    installWrappers();
    buildUi();
    updateVisibility();
    setInterval(updateVisibility, 600);
    refreshFeatures(true);
    setInterval(() => { refreshFeatures(false); }, 10 * 60e3 + 5000);
    document.addEventListener('pointerdown', () => { if (settings.serverVoiceOn && serverHas('jarvis-tts')) unlockAudio(); }, true);
    setTimeout(alertTick, 4000);
    setInterval(alertTick, 10000);
    window.PARORDOJarvis = Object.freeze({
      version: VERSION,
      open: () => { openSheet(); },
      listen: () => { openSheet(); startListening(); },
      command: text => { if (!sheetOpen) openSheet(); handleText(text); },
      parse: text => Core.parse(text, getIndex(), { room: ctxRoom() }),
      context: () => ctxRoom(),
      learned: () => Object.assign({}, learned),
      say: text => speak(String(text || ''), () => {}),
      alerts: () => alertTick(),
      voice: () => ({ server: serverVoiceReady(), serverVoice: settings.serverVoice, device: (deviceVoice() || {}).name || '', features: [...serverFeatures] }),
      core: Core
    });
    return true;
  }
  const start = () => {
    if (install()) return;
    let tries = 0;
    const timer = setInterval(() => { if (install() || ++tries > 120) clearInterval(timer); }, 250);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
