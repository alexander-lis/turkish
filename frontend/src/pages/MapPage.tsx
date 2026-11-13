import { useQuery } from "@tanstack/react-query";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type FitViewOptions,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { graphQuery, sectionsQuery } from "../api/queries.ts";
import type { Level, Section, TopicGraph } from "../api/types.ts";
import { MapNodeActionsContext } from "../components/mapNodeActions.ts";
import { RootNode, SectionNode, TopicNode } from "../components/MapNodes.tsx";
import { MapToolbar } from "../components/MapToolbar.tsx";
import { MapTopicDialog } from "../components/MapTopicDialog.tsx";
import { PageTitle } from "../components/PageTitle.tsx";
import { QueryView } from "../components/QueryView.tsx";
import { flowEdges, flowNodes, nodeFitsCanvas } from "../lib/mapFlow.ts";
import { layoutMap, splitSections } from "../lib/mapLayout.ts";
import {
  crossLines,
  linkedTopicIds,
  topicLinks,
  type Layer,
} from "../lib/mapLinks.ts";
import {
  loadMapSettings,
  loadViewport,
  revealTopic,
  storeMapSettings,
  storeViewport,
  toggleLayer,
  toggleLevel,
  toggleSection,
  type MapSettings,
} from "../lib/mapSettings.ts";
import { buildMapTree, sectionNodeId, topicNodeId } from "../lib/mapTree.ts";

const nodeTypes = {
  root: RootNode,
  section: SectionNode,
  topic: TopicNode,
} satisfies NodeTypes;

const ARIA_LABELS = {
  "node.a11yDescription.default": "Узел карты тем.",
  "node.a11yDescription.keyboardDisabled": "Узел карты тем.",
  "edge.a11yDescription.default": "Связь между темами.",
  "controls.ariaLabel": "Масштаб карты",
  "controls.zoomIn.ariaLabel": "Увеличить",
  "controls.zoomOut.ariaLabel": "Уменьшить",
  "controls.fitView.ariaLabel": "Показать всё",
  "controls.interactive.ariaLabel": "Закрепить карту",
  "minimap.ariaLabel": "Мини-карта",
  "handle.ariaLabel": "Точка связи",
};

const ANIMATION_MS = 300;
/** Ширина, с которой блок переключателей раскрыт всегда: брейкпойнт sm у Tailwind. */
const WIDE_MIN_WIDTH = 640;

/**
 * Вписывание в экран с отступами под блок переключателей, чтобы он не закрывал узлы:
 * на широком экране блок стоит слева (left-3 и w-72), на узком свёрнут в кнопку сверху.
 */
function fitOptions(): FitViewOptions {
  return {
    padding:
      window.innerWidth >= WIDE_MIN_WIDTH
        ? { top: "32px", right: "32px", bottom: "32px", left: "324px" }
        : { top: "60px", right: "16px", bottom: "16px", left: "16px" },
  };
}

/**
 * Положение карты при открытии: сохранённое, а если его нет — вписать карту в экран.
 */
function initialView() {
  const saved = loadViewport();
  return saved === null
    ? { fitView: true, fitViewOptions: fitOptions() }
    : { defaultViewport: saved };
}
const EMPTY = new Set<string>();

function isVisible(
  settings: MapSettings,
  topic: { level: Level; section_id: string },
): boolean {
  return (
    settings.levels.has(topic.level) && settings.expanded.has(topic.section_id)
  );
}

/** Узел, место которого на экране не должно сдвинуться после новой раскладки. */
interface Anchor {
  nodeId: string;
  x: number;
  y: number;
}

function MapView({
  graph,
  sections,
}: {
  graph: TopicGraph;
  sections: Section[];
}) {
  const { fitView, getViewport, setViewport, setCenter } = useReactFlow();
  const sectionIds = useMemo(
    () => sections.map((section) => section.id),
    [sections],
  );
  const byId = useMemo(
    () => new Map(graph.topics.map((topic) => [topic.id, topic])),
    [graph],
  );
  const sides = useMemo(
    () => splitSections(graph.topics, sections),
    [graph, sections],
  );
  const [settings, setSettings] = useState(() => loadMapSettings(sectionIds));
  // Хранилище читается один раз: дальше положением карты владеет холст.
  const [view] = useState(initialView);
  // Тема, на узел которой наведён указатель или фокус клавиатуры.
  const [hovered, setHovered] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const requested = searchParams.get("topic");
  const selectedTopic = requested === null ? undefined : byId.get(requested);
  const selected = selectedTopic?.id ?? null;

  // Адрес главнее сохранённых настроек: тема из нового адреса раскрывается, даже если
  // её раздел свёрнут или уровень выключен. Проверка — на каждый переход, а не на каждую
  // отрисовку: иначе свёрнутый читателем раздел тут же развернулся бы снова.
  const [checkedLocation, setCheckedLocation] = useState<string | null>(null);
  if (checkedLocation !== location.key) {
    setCheckedLocation(location.key);
    if (selectedTopic && !isVisible(settings, selectedTopic)) {
      setSettings(revealTopic(settings, selectedTopic));
    }
  }

  useEffect(() => {
    storeMapSettings(settings);
  }, [settings]);

  const tree = useMemo(
    () => buildMapTree(graph, sections, settings),
    [graph, sections, settings],
  );
  const layout = useMemo(() => layoutMap(tree, sides), [tree, sides]);

  // Узел под указателем исчез вместе со свёрнутым разделом или выключенным уровнем:
  // события ухода указателя уже не будет, подсветку снимаем сами.
  if (hovered !== null && !tree.visible.has(hovered)) {
    setHovered(null);
  }
  // Тема, связи которой показаны: выбранная, а пока выбора нет — та, на которую навели.
  const highlighted = selected ?? hovered;
  const links = useMemo(
    () => (highlighted === null ? null : topicLinks(graph, highlighted)),
    [graph, highlighted],
  );
  const nodes = useMemo(
    () =>
      flowNodes(layout, {
        selected,
        highlighted,
        linked: links ? linkedTopicIds(links) : EMPTY,
      }),
    [layout, selected, highlighted, links],
  );
  const edges = useMemo(
    () =>
      flowEdges(
        layout,
        crossLines(graph, tree, {
          layers: settings.layers,
          selected: highlighted,
        }),
        byId,
      ),
    [layout, graph, tree, settings.layers, highlighted, byId],
  );

  const [ready, setReady] = useState(false);
  const anchor = useRef<Anchor | null>(null);
  const fitPending = useRef(false);
  const container = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const pinned = anchor.current;
    anchor.current = null;
    if (!pinned) {
      return;
    }
    const moved = layout.nodes.find((node) => node.id === pinned.nodeId);
    if (moved) {
      const viewport = getViewport();
      void setViewport({
        x: viewport.x - (moved.x - pinned.x) * viewport.zoom,
        y: viewport.y - (moved.y - pinned.y) * viewport.zoom,
        zoom: viewport.zoom,
      });
    }
  }, [layout, getViewport, setViewport]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    // Холст получает новые узлы после этой отрисовки: двигаем вид в следующем кадре.
    const frame = requestAnimationFrame(() => {
      if (fitPending.current) {
        fitPending.current = false;
        void fitView({ ...fitOptions(), duration: ANIMATION_MS });
      }
      // Тема из адреса должна быть на экране, откуда бы адрес ни пришёл: открытие
      // по ссылке, возврат со страницы темы, переход внутри окна. Если её узел виден
      // целиком, вид не трогаем: читатель найдёт карту там, где оставил.
      const node =
        selected === null
          ? undefined
          : layout.nodes.find((placed) => placed.id === topicNodeId(selected));
      const canvas = container.current?.getBoundingClientRect();
      if (!node || !canvas) {
        return;
      }
      const viewport = getViewport();
      if (!nodeFitsCanvas(node, viewport, canvas)) {
        // Без анимации: карта в этот момент под окном темы, а следующий переход в окне
        // застал бы вид на полпути и сверился бы с промежуточным положением.
        void setCenter(node.x, node.y, { zoom: Math.max(viewport.zoom, 1) });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, layout, selected, fitView, getViewport, setCenter]);

  const actions = useMemo(
    () => ({
      selectTopic: (id: string) => {
        // Узел закроет окно темы, и событие ухода указателя с него может не прийти.
        setHovered(null);
        setSearchParams({ topic: id });
      },
      // Снять подсветку может только тот узел, который её поставил: указатель и фокус
      // клавиатуры могут стоять на разных узлах.
      highlightTopic: (id: string, on: boolean) => {
        setHovered((current) => {
          if (on) {
            return id;
          }
          return current === id ? null : current;
        });
      },
      toggleSection: (id: string) => {
        const node = layout.nodes.find(
          (placed) => placed.id === sectionNodeId(id),
        );
        if (node) {
          anchor.current = { nodeId: node.id, x: node.x, y: node.y };
        }
        setSettings(toggleSection(settings, id));
      },
    }),
    [layout, settings, setSearchParams],
  );

  const allExpanded = sectionIds.every((id) => settings.expanded.has(id));

  return (
    <MapNodeActionsContext value={actions}>
      <div ref={container} className="relative size-full">
        <ReactFlow
          aria-label="Карта тем"
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          deleteKeyCode={null}
          selectionKeyCode={null}
          multiSelectionKeyCode={null}
          {...view}
          minZoom={0.05}
          maxZoom={2}
          onInit={() => setReady(true)}
          // Срабатывает после сдвига, масштаба и анимации, а не на каждый кадр.
          onMoveEnd={(_, viewport) => storeViewport(viewport)}
          ariaLabelConfig={ARIA_LABELS}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={28}
            size={1.5}
            color="#cbd5e1"
          />
          <Controls showFitView={false} showInteractive={false} />
        </ReactFlow>
        <MapToolbar
          settings={settings}
          allExpanded={allExpanded}
          onToggleLevel={(level: Level) =>
            setSettings(toggleLevel(settings, level))
          }
          onToggleLayer={(layer: Layer) =>
            setSettings(toggleLayer(settings, layer))
          }
          onExpandAll={(expand) => {
            fitPending.current = true;
            setSettings({
              ...settings,
              expanded: new Set(expand ? sectionIds : []),
            });
          }}
          onFitView={() =>
            void fitView({ ...fitOptions(), duration: ANIMATION_MS })
          }
        />
        <MapTopicDialog
          topic={selectedTopic ?? null}
          sectionTitle={
            sections.find((section) => section.id === selectedTopic?.section_id)
              ?.title ?? ""
          }
          // Пока тема выбрана, links — её связи: выбранная тема главнее наведения.
          requiredFor={selected !== null && links ? links.requiredFor : []}
          onClose={() => setSearchParams({})}
        />
      </div>
    </MapNodeActionsContext>
  );
}

/** Страница «Карта тем»: дерево разделов, обзоров и тем со связями графа тем. */
export function MapPage() {
  const graph = useQuery(graphQuery);
  const sections = useQuery(sectionsQuery);
  return (
    <div className="size-full [&>[role=alert]]:m-4 [&>[role=status]]:px-4">
      <PageTitle>Карта тем</PageTitle>
      <QueryView query={graph}>
        {(loadedGraph) => (
          <QueryView query={sections}>
            {(loadedSections) => (
              <ReactFlowProvider>
                <MapView graph={loadedGraph} sections={loadedSections} />
              </ReactFlowProvider>
            )}
          </QueryView>
        )}
      </QueryView>
    </div>
  );
}
