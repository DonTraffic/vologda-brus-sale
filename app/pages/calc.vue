<script setup lang="ts">
import {
  PRICE_DATE, PAYMENT, TIMBER, DEFAULT_HEIGHT, K_BASE_HEIGHT, VENEC_HEIGHT,
  PACKAGES, VK_GROUP_URL, type PaymentId,
} from '~/data/pricing'

useHead({
  title: 'Калькулятор стенового комплекта из бруса — Вологда Брус',
  meta: [
    {
      name: 'description',
      content: 'Прикидка цены стенового комплекта из клеёного и двойного бруса: '
        + 'вводите площадь в м² или кубатуру в м³ — покажем и то и другое. '
        + 'Несколько этажей со своей высотой. Заводская формула — кубатура × тариф за м³.',
    },
  ],
})

type Unit = 'm2' | 'm3'

interface Floor {
  id: number
  unit: Unit
  value: number | null
  /** null — берём общую высоту; своё число перебивает её только на этом этаже */
  height: number | null
}

let nextId = 1
const makeFloor = (unit: Unit = 'm2'): Floor =>
  ({ id: nextId++, unit, value: null, height: null })

const floors = ref<Floor[]>([makeFloor()])
const timberId = ref(TIMBER[4]!.id)      // клеёный 200×190 — самый ходовой в каталоге
const paymentId = ref<PaymentId>('cash')
const baseHeight = ref<number | null>(DEFAULT_HEIGHT)

const timber = computed(() => TIMBER.find(t => t.id === timberId.value)!)
const rate = computed(() => PAYMENT[paymentId.value].rate)

/** Надбавка за безнал — доплата за форму оплаты, поэтому её же применяем
 *  к ориентирам расширенных комплектаций, чтобы они не спорили с итогом. */
const surcharge = computed(() => rate.value - PAYMENT.cash.rate)
const packageRate = (base: number) => base + surcharge.value

const positive = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Общая высота: если поле очистили, не ломаемся — возвращаемся к нормативу. */
const commonHeight = computed(() => positive(baseHeight.value) ?? DEFAULT_HEIGHT)

/** Высота этажа: своя, если задана, иначе общая. */
const heightOf = (f: Floor) => positive(f.height) ?? commonHeight.value

/** Сколько венцов по 190 мм укладывается в высоту и что выйдет физически. */
const venec = (h: number) => {
  const exact = h / VENEC_HEIGHT
  const rows = Math.ceil(exact - 1e-9)
  return { exact, rows, real: rows * VENEC_HEIGHT, fits: Math.abs(exact - rows) < 1e-9 }
}

const addFloor = () => {
  if (floors.value.length < 4) floors.value.push(makeFloor())
}
const removeFloor = (id: number) => {
  if (floors.value.length > 1) floors.value = floors.value.filter(f => f.id !== id)
}

const floorLabel = (i: number) => `${i + 1} этаж`

/**
 * Один этаж. Считаем обе величины всегда: что ввели — то точное,
 * обратную получаем через k с поправкой на высоту.
 *   м² → V = S × k × (h / K_BASE_HEIGHT)
 *   м³ → S = V / (k × (h / K_BASE_HEIGHT))
 * Коэффициенты k откалиброваны на нормативе 3,0 м, поэтому и делим на него.
 */
const calcFloor = (f: Floor) => {
  const h = heightOf(f)
  const hf = h / K_BASE_HEIGHT
  const k = timber.value.k
  const v = positive(f.value)
  const overridden = positive(f.height) !== null && positive(f.height) !== commonHeight.value

  if (!v) {
    return {
      empty: true, height: h, overridden,
      areaMin: 0, areaMax: 0, areaExact: true,
      volMin: 0, volMax: 0, volExact: true,
    }
  }

  if (f.unit === 'm2') {
    return {
      empty: false, height: h, overridden,
      areaMin: v, areaMax: v, areaExact: true,
      volMin: v * k.min * hf, volMax: v * k.max * hf, volExact: false,
    }
  }

  // Обратный счёт: больший расход k означает меньшую площадь при той же кубатуре,
  // поэтому границы площади переворачиваются относительно границ k.
  return {
    empty: false, height: h, overridden,
    volMin: v, volMax: v, volExact: true,
    areaMin: v / (k.max * hf), areaMax: v / (k.min * hf), areaExact: false,
  }
}

const rows = computed(() => floors.value.map((f, i) => ({
  floor: f,
  label: floorLabel(i),
  ...calcFloor(f),
})))

const total = computed(() => {
  const live = rows.value.filter(r => !r.empty)

  const t = live.reduce((acc, r) => ({
    areaMin: acc.areaMin + r.areaMin,
    areaMax: acc.areaMax + r.areaMax,
    volMin: acc.volMin + r.volMin,
    volMax: acc.volMax + r.volMax,
  }), { areaMin: 0, areaMax: 0, volMin: 0, volMax: 0 })

  return {
    ...t,
    filled: live.length > 0,
    areaExact: live.every(r => r.areaExact),
    volExact: live.every(r => r.volExact),
    byArea: live.some(r => r.floor.unit === 'm2'),
    byVolume: live.some(r => r.floor.unit === 'm3'),
  }
})

const priceMin = computed(() => total.value.volMin * rate.value)
const priceMax = computed(() => total.value.volMax * rate.value)

/**
 * Цена за м² и расход. Обе величины могут быть вилками, поэтому берём
 * честные крайности: дешёвый край делим на большую площадь, дорогой — на меньшую.
 */
const perM2 = computed(() => {
  if (!total.value.areaMax) return null
  return { min: priceMin.value / total.value.areaMax, max: priceMax.value / total.value.areaMin }
})

const consumption = computed(() => {
  if (!total.value.areaMax) return null
  return {
    min: total.value.volMin / total.value.areaMax,
    max: total.value.volMax / total.value.areaMin,
  }
})

const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
const money = (n: number) => nf.format(Math.round(n))
const vol = (n: number) =>
  n.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const num = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
const area = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
const coef = (n: number) => n.toLocaleString('ru-RU', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
</script>

<template>
  <div class="page">
    <main class="wrap">
      <header class="head">
        <p class="eyebrow">Вологда Брус · отдел продаж</p>
        <h1>Калькулятор стенового комплекта</h1>
        <p class="lede">
          Завод продаёт не «дом», а <strong>стенокомплект в кубометрах</strong>. Поэтому
          считаем одной формулой: <em>кубатура × тариф за м³</em>. Введите что знаете —
          площадь или кубатуру, — покажем сразу и то и другое.
        </p>
      </header>

      <!-- Параметры -->
      <section class="card">
        <h2 class="card-title">Что строим</h2>

        <label class="field">
          <span class="field-label">Тип и сечение бруса</span>
          <select v-model="timberId" class="control">
            <option v-for="t in TIMBER" :key="t.id" :value="t.id">{{ t.label }}</option>
          </select>
        </label>

        <label class="field">
          <span class="field-label">Высота этажа по умолчанию</span>
          <div class="suffix-group">
            <input
              v-model.number="baseHeight" class="control" type="number"
              min="0" step="0.01" inputmode="decimal" :placeholder="String(DEFAULT_HEIGHT)"
            >
            <span class="suffix">м</span>
          </div>
          <p class="hint">
            Норматив завода — {{ num(DEFAULT_HEIGHT) }} м, принят для прикидок, потому что
            на планировках вид сверху и высот там нет. Любой этаж ниже можно пересчитать
            на свою высоту.
          </p>
          <p class="hint venec">
            <template v-if="venec(commonHeight).fits">
              {{ num(commonHeight) }} м — ровно {{ venec(commonHeight).rows }} венцов по 190 мм.
            </template>
            <template v-else>
              ⚠ {{ num(commonHeight) }} м не кратно венцу 190 мм: это
              {{ num(venec(commonHeight).exact) }} венца, физически стена наберётся
              {{ venec(commonHeight).rows }} венцами = {{ num(venec(commonHeight).real) }} м.
              Для коммерческого предложения считать по венцам.
            </template>
          </p>
        </label>

        <div class="field">
          <span class="field-label">Форма оплаты</span>
          <div class="segment">
            <button
              v-for="p in PAYMENT" :key="p.id" type="button"
              class="segment-btn" :class="{ 'is-active': paymentId === p.id }"
              @click="paymentId = p.id as PaymentId"
            >
              {{ p.label }}
              <small>{{ money(p.rate) }} ₽/м³</small>
            </button>
          </div>
          <p class="hint">{{ PAYMENT[paymentId].note }}. Прайс от {{ PRICE_DATE }}.</p>
        </div>
      </section>

      <!-- Этажи -->
      <section class="card">
        <h2 class="card-title">Этажи</h2>
        <p class="card-sub">
          Можно смешивать: первый этаж в м², второй — сразу в м³. У каждого этажа своя
          высота: пусто — берётся общая. Высота меняет кубатуру линейно.
        </p>

        <div class="floors">
          <div v-for="r in rows" :key="r.floor.id" class="floor">
            <div class="floor-head">
              <span class="floor-name">{{ r.label }}</span>
              <button
                v-if="rows.length > 1" type="button" class="remove"
                :aria-label="`Убрать ${r.label}`" @click="removeFloor(r.floor.id)"
              >
                Убрать
              </button>
            </div>

            <div class="floor-body">
              <div class="input-group">
                <input
                  v-model.number="r.floor.value" class="control number"
                  type="number" min="0" step="0.1" inputmode="decimal"
                  :placeholder="r.floor.unit === 'm2' ? 'например 90' : 'например 20,8'"
                  :aria-label="`Значение для ${r.label}`"
                >
                <div class="units">
                  <button
                    type="button" class="unit" :class="{ 'is-active': r.floor.unit === 'm2' }"
                    @click="r.floor.unit = 'm2'"
                  >м²</button>
                  <button
                    type="button" class="unit" :class="{ 'is-active': r.floor.unit === 'm3' }"
                    @click="r.floor.unit = 'm3'"
                  >м³</button>
                </div>
              </div>

              <div class="height-row">
                <span class="height-label">Высота</span>
                <div class="suffix-group narrow">
                  <input
                    v-model.number="r.floor.height" class="control" type="number"
                    min="0" step="0.01" inputmode="decimal" :placeholder="num(commonHeight)"
                    :aria-label="`Высота ${r.label}, м`"
                  >
                  <span class="suffix">м</span>
                </div>
                <button
                  v-if="r.overridden" type="button" class="reset"
                  @click="r.floor.height = null"
                >
                  вернуть общую
                </button>
                <span v-else class="height-note">как общая</span>
              </div>
            </div>

            <p v-if="!r.empty" class="floor-out">
              <span class="out-main">
                <template v-if="r.areaExact">{{ area(r.areaMin) }} м²</template>
                <template v-else>≈ {{ area(r.areaMin) }}–{{ area(r.areaMax) }} м²</template>
              </span>
              <span class="out-sep">·</span>
              <span class="out-main">
                <template v-if="r.volExact">{{ vol(r.volMin) }} м³</template>
                <template v-else>≈ {{ vol(r.volMin) }}–{{ vol(r.volMax) }} м³</template>
              </span>
              <span v-if="r.height !== commonHeight" class="out-src">
                · высота {{ num(r.height) }} м
              </span>
            </p>
          </div>
        </div>

        <button v-if="floors.length < 4" type="button" class="add" @click="addFloor">
          + Добавить этаж
        </button>

        <p class="hint attic-note">
          <strong>Про мансарду.</strong> Если поставить высоту колена (скажем, 1,14 м),
          кубатура выйдет заниженной: фронтоны и стенки балкона от высоты колена не
          зависят, а коэффициенты расхода и так посчитаны по каталогу, где мансарды
          встречаются. На бане 5×6 завод даёт 17,0 м³, а расчёт по колену — около 15.
          Для мансардного этажа надёжнее ввести кубатуру в м³ либо оставить
          нормативную высоту.
        </p>
      </section>

      <!-- Результат -->
      <section class="card result" :class="{ 'is-empty': !total.filled }">
        <h2 class="card-title">Стеновой комплект</h2>

        <template v-if="total.filled">
          <p class="price">
            <template v-if="total.volExact">{{ money(priceMin) }} ₽</template>
            <template v-else>{{ money(priceMin) }} — {{ money(priceMax) }} ₽</template>
          </p>

          <p class="formula">
            <template v-if="total.volExact">
              {{ vol(total.volMin) }} м³ × {{ money(rate) }} ₽/м³
            </template>
            <template v-else>
              {{ vol(total.volMin) }}–{{ vol(total.volMax) }} м³ × {{ money(rate) }} ₽/м³
            </template>
            · прайс от {{ PRICE_DATE }}
          </p>

          <dl class="facts">
            <div class="fact">
              <dt>Площадь</dt>
              <dd>
                <template v-if="total.areaExact">{{ area(total.areaMin) }} м²</template>
                <template v-else>≈ {{ area(total.areaMin) }}–{{ area(total.areaMax) }} м²</template>
              </dd>
            </div>
            <div class="fact">
              <dt>Кубатура</dt>
              <dd>
                <template v-if="total.volExact">{{ vol(total.volMin) }} м³</template>
                <template v-else>≈ {{ vol(total.volMin) }}–{{ vol(total.volMax) }} м³</template>
              </dd>
            </div>
            <div v-if="perM2" class="fact">
              <dt>Цена за м²</dt>
              <dd>
                <template v-if="total.volExact && total.areaExact">{{ money(perM2.min) }} ₽</template>
                <template v-else>{{ money(perM2.min) }}–{{ money(perM2.max) }} ₽</template>
              </dd>
            </div>
            <div v-if="consumption" class="fact">
              <dt>Расход бруса</dt>
              <dd>
                <template v-if="total.volExact && total.areaExact">{{ coef(consumption.min) }} м³/м²</template>
                <template v-else>{{ coef(consumption.min) }}–{{ coef(consumption.max) }} м³/м²</template>
              </dd>
            </div>
          </dl>

          <p v-if="total.byArea" class="range-why">
            Кубатура дана вилкой: при одной площади она зависит от планировки, числа
            перегородок и сечения. Коридор построен на кубатурах заводского каталога
            ({{ timber.basis }}) и пересчитан на вашу высоту этажа.
          </p>

          <p v-if="total.byVolume" class="range-why">
            Площадь по кубатуре — обратный счёт, он грубее прямого: один и тот же объём
            бруса даёт разную площадь в зависимости от планировки. Цена при этом точная,
            она считается от кубатуры.
          </p>
        </template>

        <p v-else class="placeholder">
          Введите площадь или кубатуру этажа — посчитаем.
        </p>
      </section>

      <!-- Что входит -->
      <section class="card">
        <h2 class="card-title">Что в этой цене есть, а чего нет</h2>
        <div class="two-col">
          <div>
            <h3 class="mini">Входит</h3>
            <ul class="list yes">
              <li>Брус с запилом чаш по проекту</li>
              <li>Паз под окосячку 40×40</li>
              <li>Торцы обработаны герметиком</li>
              <li>Маркировка венцов и схема сборки</li>
              <li>Упаковка в палеты</li>
            </ul>
          </div>
          <div>
            <h3 class="mini">Не входит</h3>
            <ul class="list no">
              <li>Фундамент</li>
              <li>Балки перекрытия и стропильная система</li>
              <li>Кровля, окна, двери</li>
              <li>Доставка на участок</li>
              <li>Сборка и инженерка</li>
            </ul>
          </div>
        </div>

        <details v-if="total.filled" class="more">
          <summary>Ориентиры по расширенным комплектациям</summary>
          <ul class="packages">
            <li v-for="p in PACKAGES" :key="p.id">
              <span class="pkg-label">{{ p.label }}</span>
              <span class="pkg-price">
                <template v-if="total.volExact">{{ money(total.volMin * packageRate(p.rate)) }} ₽</template>
                <template v-else>{{ money(total.volMin * packageRate(p.rate)) }}–{{ money(total.volMax * packageRate(p.rate)) }} ₽</template>
              </span>
              <span class="pkg-note">
                {{ money(packageRate(p.rate)) }} ₽/м³ ·
                {{ p.verified ? 'прайс завода' : 'ориентир с сайта, прайсом не подтверждён' }}
              </span>
            </li>
          </ul>
          <p class="hint">
            Два верхних тарифа взяты с сайта завода и в заводском прайсе не закреплены.
            Для сметы годится только первая строка.
          </p>
        </details>
      </section>

      <!-- CTA -->
      <section class="cta">
        <h2>Нужна точная цифра?</h2>
        <p>
          Калькулятор даёт прикидку по геометрии. Точную кубатуру считает завод — по вашей
          планировке или просто по размерам «хочу баню 6×6 в два этажа». Расчёт бесплатный,
          за один день, без предоплаты и без «оставьте номер, менеджер перезвонит».
        </p>
        <a class="cta-btn" :href="VK_GROUP_URL" target="_blank" rel="noopener">
          Написать в сообщения группы
        </a>
      </section>

      <footer class="foot">
        <p>
          Расчёт справочный и не является публичной офертой. Цена стенового комплекта
          зависит от итоговой кубатуры по проекту; тариф — по прайсу завода
          от {{ PRICE_DATE }} и может измениться.
        </p>
      </footer>
    </main>
  </div>
</template>

<style scoped>
:global(:root) {
  --bg: #f7f3ec;
  --surface: #fffdfa;
  --ink: #241f1a;
  --muted: #776b5d;
  --line: #e5dccd;
  --accent: #a8561a;
  --accent-soft: #fdf1e5;
  --ok: #3f7d4e;
  --radius: 14px;
}

@media (prefers-color-scheme: dark) {
  :global(:root) {
    --bg: #17140f;
    --surface: #211d17;
    --ink: #f0e9df;
    --muted: #a3978a;
    --line: #342e25;
    --accent: #e08a45;
    --accent-soft: #2c2218;
    --ok: #7bbd8b;
  }
}

:global(*), :global(*::before), :global(*::after) { box-sizing: border-box; }
:global(body) { margin: 0; background: var(--bg); }

.page {
  min-height: 100vh;
  background: var(--bg);
  color: var(--ink);
  font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.55;
  -webkit-text-size-adjust: 100%;
}

.wrap {
  max-width: 44rem;
  margin: 0 auto;
  padding: 2rem 1rem 3rem;
}

/* ───────── шапка ───────── */
.head { margin-bottom: 1.75rem; }

.eyebrow {
  margin: 0 0 .5rem;
  font-size: .8rem;
  font-weight: 600;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--accent);
}

h1 {
  margin: 0 0 .75rem;
  font-size: clamp(1.6rem, 6vw, 2.2rem);
  line-height: 1.15;
  letter-spacing: -.02em;
}

.lede { margin: 0; color: var(--muted); }
.lede strong { color: var(--ink); }

/* ───────── карточки ───────── */
.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 1.25rem;
  margin-bottom: 1rem;
}

.card-title {
  margin: 0 0 1rem;
  font-size: 1.05rem;
  letter-spacing: -.01em;
}

.card-sub {
  margin: -.6rem 0 1rem;
  font-size: .88rem;
  color: var(--muted);
}

/* ───────── поля ───────── */
.field { display: block; margin-bottom: 1.1rem; }
.field:last-child { margin-bottom: 0; }

.field-label {
  display: block;
  margin-bottom: .4rem;
  font-size: .85rem;
  font-weight: 600;
  color: var(--muted);
}

.control {
  width: 100%;
  padding: .7rem .8rem;
  font: inherit;
  font-size: 1rem; /* 16px — иначе iOS зумит форму */
  color: var(--ink);
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 10px;
  appearance: none;
}

.control:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

select.control {
  background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%),
                    linear-gradient(135deg, var(--muted) 50%, transparent 50%);
  background-position: calc(100% - 1.1rem) 1.15rem, calc(100% - .75rem) 1.15rem;
  background-size: 6px 6px, 6px 6px;
  background-repeat: no-repeat;
  padding-right: 2.2rem;
}

.hint {
  margin: .45rem 0 0;
  font-size: .8rem;
  color: var(--muted);
}

/* ───────── переключатель оплаты ───────── */
.segment {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .5rem;
}

.segment-btn {
  display: flex;
  flex-direction: column;
  gap: .15rem;
  padding: .65rem .5rem;
  font: inherit;
  font-weight: 600;
  color: var(--muted);
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color .15s, color .15s, background .15s;
}

.segment-btn small { font-weight: 400; font-size: .78rem; }

.segment-btn.is-active {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: var(--accent);
}

/* ───────── этажи ───────── */
.floors { display: flex; flex-direction: column; gap: .85rem; }

.floor {
  padding: .9rem;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 12px;
}

.floor-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: .6rem;
}

.floor-name { font-weight: 600; font-size: .95rem; }

.remove {
  padding: 0;
  font: inherit;
  font-size: .82rem;
  color: var(--muted);
  background: none;
  border: 0;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.remove:hover { color: var(--accent); }

.floor-body { display: flex; flex-direction: column; gap: .5rem; }

.input-group { display: flex; gap: .5rem; }
.input-group .number { flex: 1; min-width: 0; }

.units {
  display: flex;
  flex: 0 0 auto;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}

.unit {
  padding: 0 .85rem;
  font: inherit;
  font-size: 1rem;
  font-weight: 600;
  color: var(--muted);
  background: none;
  border: 0;
  cursor: pointer;
  transition: color .15s, background .15s;
}

.unit.is-active { color: #fff; background: var(--accent); }

/* поле с единицей внутри: [ 3,0 ] м */
.suffix-group { position: relative; display: block; }
.suffix-group .control { padding-right: 2.4rem; }
.suffix-group.narrow { width: 6.5rem; flex: 0 0 auto; }

.suffix {
  position: absolute;
  top: 50%;
  right: .8rem;
  transform: translateY(-50%);
  font-size: .9rem;
  color: var(--muted);
  pointer-events: none;
}

.venec { font-size: .78rem; opacity: .9; }

.attic-note {
  margin-top: .85rem;
  padding-top: .85rem;
  border-top: 1px solid var(--line);
}

.attic-note strong { color: var(--ink); }

/* строка высоты внутри этажа */
.height-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .5rem;
}

.height-label {
  font-size: .85rem;
  font-weight: 600;
  color: var(--muted);
}

.reset, .height-note {
  font-size: .78rem;
  color: var(--muted);
}

.reset {
  padding: 0;
  font-family: inherit;
  background: none;
  border: 0;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.reset:hover { color: var(--accent); }

.floor-out {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: .35rem;
  margin: .6rem 0 0;
  padding-top: .6rem;
  border-top: 1px dashed var(--line);
  font-size: .88rem;
}

.out-main { font-weight: 600; color: var(--ok); }
.out-sep { color: var(--line); }
.out-src { color: var(--muted); }

.add {
  width: 100%;
  margin-top: .85rem;
  padding: .7rem;
  font: inherit;
  font-weight: 600;
  color: var(--accent);
  background: none;
  border: 1px dashed var(--line);
  border-radius: 10px;
  cursor: pointer;
}

.add:hover { background: var(--accent-soft); border-color: var(--accent); }

/* ───────── результат ───────── */
.result {
  background: var(--accent-soft);
  border-color: var(--accent);
}

.result.is-empty { background: var(--surface); border-color: var(--line); }

.price {
  margin: 0 0 .35rem;
  font-size: clamp(1.5rem, 7vw, 2.1rem);
  font-weight: 700;
  letter-spacing: -.02em;
  line-height: 1.1;
  color: var(--accent);
}

.formula {
  margin: 0 0 1rem;
  font-size: .85rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
  gap: .75rem;
  margin: 0 0 1rem;
  padding: .9rem 0 0;
  border-top: 1px solid var(--line);
}

.fact dt {
  font-size: .78rem;
  color: var(--muted);
  margin-bottom: .15rem;
}

.fact dd {
  margin: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.range-why, .placeholder {
  margin: 0;
  font-size: .85rem;
  color: var(--muted);
}

/* ───────── что входит ───────── */
.two-col {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.1rem;
}

@media (min-width: 30rem) {
  .two-col { grid-template-columns: 1fr 1fr; gap: 1.5rem; }
}

.mini {
  margin: 0 0 .5rem;
  font-size: .82rem;
  font-weight: 600;
  letter-spacing: .04em;
  text-transform: uppercase;
  color: var(--muted);
}

.list { margin: 0; padding: 0; list-style: none; font-size: .9rem; }
.list li { position: relative; padding-left: 1.3rem; margin-bottom: .35rem; }

.list li::before {
  position: absolute;
  left: 0;
  font-weight: 700;
}

.list.yes li::before { content: '✓'; color: var(--ok); }
.list.no li::before { content: '—'; color: var(--muted); }

/* ───────── комплектации ───────── */
.more {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
}

.more summary {
  font-size: .9rem;
  font-weight: 600;
  color: var(--accent);
  cursor: pointer;
}

.packages { margin: .9rem 0 0; padding: 0; list-style: none; }

.packages li {
  display: grid;
  gap: .1rem;
  padding: .6rem 0;
  border-bottom: 1px solid var(--line);
}

.pkg-label { font-size: .9rem; font-weight: 600; }
.pkg-price { font-size: .95rem; font-variant-numeric: tabular-nums; }
.pkg-note { font-size: .76rem; color: var(--muted); }

/* ───────── CTA ───────── */
.cta {
  margin: 1.75rem 0 0;
  padding: 1.5rem 1.25rem;
  text-align: center;
  background: var(--ink);
  border-radius: var(--radius);
}

.cta h2 {
  margin: 0 0 .6rem;
  font-size: 1.2rem;
  color: var(--surface);
}

.cta p {
  margin: 0 0 1.25rem;
  font-size: .92rem;
  color: var(--line);
}

.cta-btn {
  display: inline-block;
  padding: .8rem 1.5rem;
  font-weight: 600;
  color: #fff;
  background: var(--accent);
  border-radius: 10px;
  text-decoration: none;
}

.cta-btn:hover { filter: brightness(1.1); }

/* ───────── подвал ───────── */
.foot { margin: 1.5rem 0 0; }

.foot p {
  margin: 0;
  font-size: .78rem;
  color: var(--muted);
}
</style>
