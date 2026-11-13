import { useQuery } from "@tanstack/react-query";
import {
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { graphQuery, topicMapQuery } from "../api/queries.ts";
import type { Level, Section, TopicGraph } from "../api/types.ts";
import { MapNodeActionsContext } from "../components/mapNodeActions.ts";
import { RootNode, SectionNode, TopicNode } from "../components/MapNodes.tsx";
import { MapToolbar } from "../components/MapToolbar.tsx";
import { MapTopicPanel } from "../components/MapTopicPanel.tsx";
import { PageTitle } from "../components/PageTitle.tsx";
import { QueryView } from "../components/QueryView.tsx";
import { flowEdges, flowNodes } from "../lib/mapFlow.ts";
import { layoutMap, splitSections } from "../lib/mapLayout.ts";
import {
  crossLines,
  linkedTopicIds,
  topicLinks,
  type Layer,
} from "../lib/mapLinks.ts";
import {
  loadMapSettings,
  revealTopic,
  storeMapSettings,
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

const FIT_PADDING = 0.12;
/** Ширина, с которой панель темы стоит справа, а не внизу: брейкпойнт sm у Tailwind. */
const SIDE_PANEL_MIN_WIDTH = 640;
/** Ширина панели темы справа вместе с отступом: w-80 и right-3. */
const SIDE_PANEL_WIDTH = 332;
const ANIMATION_MS = 300;
const EMPTY = new Set<string>();

function isVisible(
  settings: MapSettings,
  topic: { level: Level; section_id: string },
): boolean {
  return (
    settings.levels.has(topic.level) && settings.expanded.has(topic.section_id)
  );
}

/**
 * Сдвиг центра вида, при котором узел встаёт посередине части холста, свободной от панели
 * темы: на узком экране панель занимает нижнюю половину, на широком — полосу справа.
 */
function panelOffset(
  container: HTMLElement | null,
  zoom: number,
): { dx: number; dy: number } {
  if (!container) {
    return { dx: 0, dy: 0 };
  }
  const { width, height } = container.getBoundingClientRect();
  return width < SIDE_PANEL_MIN_WIDTH
    ? { dx: 0, dy: height / 4 / zoom }
    : { dx: SIDE_PANEL_WIDTH / 2 / zoom, dy: 0 };
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
  const { fitView, getViewport, setViewport, setCenter, getZoom } =
    useReactFlow();
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
  const links = useMemo(
    () => (selected === null ? null : topicLinks(graph, selected)),
    [graph, selected],
  );
  const nodes = useMemo(
    () =>
      flowNodes(layout, {
        selected,
        linked: links ? linkedTopicIds(links) : EMPTY,
      }),
    [layout, selected, links],
  );
  const edges = useMemo(
    () =>
      flowEdges(
        layout,
        crossLines(graph, tree, { layers: settings.layers, selected }),
        byId,
      ),
    [layout, graph, tree, settings.layers, selected, byId],
  );

  const [ready, setReady] = useState(false);
  // Тема, которую нужно показать на экране: из адреса при открытии и из панели темы.
  const focusTopic = useRef<string | null>(selected);
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
        void fitView({ padding: FIT_PADDING, duration: ANIMATION_MS });
      }
      const target = focusTopic.current;
      if (target === null) {
        return;
      }
      const node = layout.nodes.find(
        (placed) => placed.id === topicNodeId(target),
      );
      if (node) {
        focusTopic.current = null;
        const zoom = Math.max(getZoom(), 1);
        const { dx, dy } = panelOffset(container.current, zoom);
        void setCenter(node.x + dx, node.y + dy, {
          zoom,
          duration: ANIMATION_MS,
        });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, layout, selected, fitView, setCenter, getZoom]);

  function select(id: string | null, focus = false) {
    focusTopic.current = focus ? id : null;
    setSearchParams(id === null ? {} : { topic: id });
  }

  function change(next: MapSettings) {
    setSettings(next);
    if (selectedTopic && !isVisible(next, selectedTopic)) {
      select(null);
    }
  }

  useEffect(() => {
    if (selected === null) {
      return;
    }
    function deselectOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        focusTopic.current = null;
        setSearchParams({});
      }
    }
    document.addEventListener("keydown", deselectOnEscape);
    return () => document.removeEventListener("keydown", deselectOnEscape);
  }, [selected, setSearchParams]);

  const actions = useMemo(
    () => ({
      selectTopic: (id: string) => {
        focusTopic.current = null;
        setSearchParams({ topic: id });
      },
      toggleSection: (id: string) => {
        const node = layout.nodes.find(
          (placed) => placed.id === sectionNodeId(id),
        );
        if (node) {
          anchor.current = { nodeId: node.id, x: node.x, y: node.y };
        }
        const next = toggleSection(settings, id);
        setSettings(next);
        if (selectedTopic && !isVisible(next, selectedTopic)) {
          focusTopic.current = null;
          setSearchParams({});
        }
      },
    }),
    [layout, settings, selectedTopic, setSearchParams],
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
          fitView={selected === null}
          fitViewOptions={{ padding: FIT_PADDING }}
          minZoom={0.05}
          maxZoom={2}
          onInit={() => setReady(true)}
          onPaneClick={() => select(null)}
          ariaLabelConfig={ARIA_LABELS}
        >
          <Controls showFitView={false} showInteractive={false} />
        </ReactFlow>
        <MapToolbar
          settings={settings}
          allExpanded={allExpanded}
          onToggleLevel={(level: Level) => change(toggleLevel(settings, level))}
          onToggleLayer={(layer: Layer) => change(toggleLayer(settings, layer))}
          onExpandAll={(expand) => {
            fitPending.current = true;
            change({
              ...settings,
              expanded: new Set(expand ? sectionIds : []),
            });
          }}
          onFitView={() =>
            void fitView({ padding: FIT_PADDING, duration: ANIMATION_MS })
          }
        />
        {selectedTopic && links && (
          <MapTopicPanel
            topic={selectedTopic}
            sectionTitle={
              sections.find(
                (section) => section.id === selectedTopic.section_id,
              )?.title ?? ""
            }
            links={links}
            onSelect={(id) => select(id, true)}
            onClose={() => select(null)}
          />
        )}
      </div>
    </MapNodeActionsContext>
  );
}

/** Страница «Карта тем»: дерево разделов, обзоров и тем со связями графа тем. */
export function MapPage() {
  const graph = useQuery(graphQuery);
  const topicMap = useQuery(topicMapQuery);
  return (
    <div className="size-full [&>[role=alert]]:m-4 [&>[role=status]]:px-4">
      <PageTitle>Карта тем</PageTitle>
      <QueryView query={graph}>
        {(loadedGraph) => (
          <QueryView query={topicMap}>
            {({ sections }) => (
              <ReactFlowProvider>
                <MapView graph={loadedGraph} sections={sections} />
              </ReactFlowProvider>
            )}
          </QueryView>
        )}
      </QueryView>
    </div>
  );
}
