import React, { useMemo, useState } from 'react';
import { Camera, Gauge, Layers, Moon, ShieldCheck, Sun, X, Zap } from 'lucide-react';
import { Accessory } from '../types';
import {
  calculateStackedVlt,
  getAccessoryNumberAttribute,
  getAccessoryStringAttribute,
  getFilmVlt,
} from '../data/categoryConfig';

interface FilmSimulatorModalProps {
  films: Accessory[];
  initialFilm?: Accessory;
  initialSecondFilm?: Accessory;
  title?: string;
  onClose: () => void;
}

type SceneKey = 'day' | 'night';

const INTERNAL_VIEW = '/catalogo/visao-interna-insulfilm.png';
const MIRROR_LAYER = '/catalogo/retrovisor-insulfilm.png';
const EXTERNAL_DAY = '/catalogo/visao-externa-insulfilm-dia.png';
const EXTERNAL_NIGHT = '/catalogo/visao-externa-insulfilm-noite.png';

const SCENES: Array<{ key: SceneKey; label: string; icon: React.ElementType; src: string }> = [
  { key: 'day', label: 'Dia', icon: Sun, src: EXTERNAL_DAY },
  { key: 'night', label: 'Noite', icon: Moon, src: EXTERNAL_NIGHT },
];

const combineRejection = (first?: number, second?: number) => {
  const a = Math.min(100, Math.max(0, first ?? 0)) / 100;
  const b = Math.min(100, Math.max(0, second ?? 0)) / 100;
  return Math.round((1 - (1 - a) * (1 - b)) * 100);
};

const getStackedMetric = (first: Accessory | undefined, second: Accessory | undefined, key: string) => {
  const firstValue = first ? getAccessoryNumberAttribute(first, key) : undefined;
  const secondValue = second ? getAccessoryNumberAttribute(second, key) : undefined;
  return combineRejection(firstValue, secondValue);
};

const getPrivacyLabel = (vlt: number) => {
  if (vlt <= 15) return 'Privacidade alta';
  if (vlt <= 35) return 'Visual esportivo';
  if (vlt <= 55) return 'Equilibrado';
  return 'Claro premium';
};

export default function FilmSimulatorModal({ films, initialFilm, initialSecondFilm, title, onClose }: FilmSimulatorModalProps) {
  const firstDefault = initialFilm?.id || films[0]?.id || '';
  const secondDefault = initialSecondFilm?.id || '';
  const [firstFilmId, setFirstFilmId] = useState(firstDefault);
  const [secondFilmId, setSecondFilmId] = useState(secondDefault);
  const [sceneKey, setSceneKey] = useState<SceneKey>('day');

  const firstFilm = useMemo(() => films.find((film) => film.id === firstFilmId), [films, firstFilmId]);
  const secondFilm = useMemo(() => films.find((film) => film.id === secondFilmId), [films, secondFilmId]);
  const finalVlt = firstFilm ? calculateStackedVlt(firstFilm, secondFilm) : 100;
  const tintOpacity = Math.min(0.88, Math.max(0, 1 - finalVlt / 100));
  const overlayColor =
    getAccessoryStringAttribute(secondFilm || firstFilm || ({} as Accessory), 'tintColor') || '#000000';
  const externalScene = SCENES.find((scene) => scene.key === sceneKey)?.src || EXTERNAL_DAY;
  const heatRejection = getStackedMetric(firstFilm, secondFilm, 'heatRejection');
  const infraredRejection = getStackedMetric(firstFilm, secondFilm, 'infraredRejection');
  const uvProtection = getStackedMetric(firstFilm, secondFilm, 'uvProtection');
  const glareReduction = Math.max(0, 100 - finalVlt);

  return (
    <div
      className="fixed inset-0 bg-slate-950/85 flex items-center justify-center p-4 z-[70] animate-fade-in no-print"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-7xl w-full max-h-[94vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#002C5F]" />
              {title || 'Câmara de Transparência Automotiva'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-0 overflow-y-auto">
          <div className="bg-slate-100 p-5 space-y-4">
            <div className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl border border-slate-300 bg-black shadow-2xl">
              <div className="relative aspect-[3/2] bg-black">
                <img
                  src={externalScene}
                  alt="Camada do fundo: cenário externo"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <img
                  src={MIRROR_LAYER}
                  alt="Camada atrás do insulfilm: retrovisor"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div
                  className="absolute inset-0 transition-opacity duration-300"
                  style={{ backgroundColor: overlayColor, opacity: tintOpacity }}
                  aria-label="Camada do meio: simulador de insulfilm"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-white/12 via-transparent to-black/10 mix-blend-screen" />
                <img
                  src={INTERNAL_VIEW}
                  alt="Camada da frente: carro"
                  className="absolute inset-0 h-full w-full object-cover"
                />

                <div className="absolute left-5 top-5 rounded-full bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-sm">
                  {getPrivacyLabel(finalVlt)} · {finalVlt}% VLT
                </div>
              </div>
            </div>

          </div>

          <div className="p-5 space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                <span className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold">VLT final</span>
                <strong className="text-3xl font-mono text-[#002C5F]">{finalVlt}%</strong>
                <span className="block text-[10px] text-slate-500 font-semibold">{getPrivacyLabel(finalVlt)}</span>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                <span className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold">Ofuscamento</span>
                <strong className="text-3xl font-mono text-slate-800">{glareReduction}%</strong>
                <span className="block text-[10px] text-slate-500 font-semibold">redução estimada</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <Metric icon={Zap} label="TSER" value={heatRejection} />
              <Metric icon={Sun} label="IR" value={infraredRejection} />
              <Metric icon={ShieldCheck} label="UV" value={uvProtection} />
              <Metric icon={Gauge} label="Escurec." value={100 - finalVlt} />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Película 1</label>
              <select
                value={firstFilmId}
                onChange={(e) => setFirstFilmId(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-bold text-slate-700"
              >
                {films.map((film) => (
                  <option key={film.id} value={film.id}>
                    {film.name} ({getFilmVlt(film)}% VLT)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Película 2 opcional</label>
              <select
                value={secondFilmId}
                onChange={(e) => setSecondFilmId(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-bold text-slate-700"
              >
                <option value="">Sem sobreposição</option>
                {films.map((film) => (
                  <option key={film.id} value={film.id}>
                    {film.name} ({getFilmVlt(film)}% VLT)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Ambiente externo</label>
              <div className="grid grid-cols-2 gap-2">
                {SCENES.map((scene) => {
                  const Icon = scene.icon;
                  const active = sceneKey === scene.key;
                  return (
                    <button
                      key={scene.key}
                      type="button"
                      onClick={() => setSceneKey(scene.key)}
                      className={`rounded-xl border p-3 text-[10px] font-bold transition-all ${
                        active ? 'border-[#002C5F] bg-blue-50 text-[#002C5F]' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="mx-auto mb-1 h-4 w-4" />
                      {scene.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-[10px] font-semibold leading-relaxed text-amber-900">
              Simulação visual consultiva. O resultado real muda por vidro original, iluminação, ângulo, marca da película e instalação.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-center">
      <Icon className="mx-auto h-4 w-4 text-[#002C5F]" />
      <span className="mt-1 block text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <strong className="font-mono text-sm text-slate-800">{value}%</strong>
    </div>
  );
}
