import React, { useCallback, useState } from "react";
import styles from "./App.module.css";

interface TraceNode {
  content: string;
  children: TraceNode[];
  depth: number;
}

const parseTrace = (trace: string): TraceNode[] => {
  const lines = trace.split("\n");
  const roots: TraceNode[] = [];
  let currentRoot: TraceNode | null = null;
  const stack: TraceNode[] = [];

  const traceLineRegex = /^[\s│├─└]+/;
  const passLineRegex = /^\[PASS\]/;

  lines.forEach((line) => {
    if (line.trim() === "Traces:") {
      if (currentRoot) {
        roots.push(currentRoot);
      }
      currentRoot = null;
      stack.length = 0;
    } else if (
      currentRoot === null &&
      line.trim() !== "" &&
      !passLineRegex.test(line)
    ) {
      currentRoot = { content: line.trim(), children: [], depth: 0 };
      stack.push(currentRoot);
    } else if (traceLineRegex.test(line)) {
      const trimmedLine = line.replace(/[│├─└]\s*/g, "").trim();
      if (!trimmedLine) return;

      const depth = (line.match(/[│]/g) || []).length;
      const newNode: TraceNode = { content: trimmedLine, children: [], depth };

      while (stack.length > 1 && depth <= stack[stack.length - 1].depth) {
        stack.pop();
      }

      stack[stack.length - 1].children.push(newNode);
      stack.push(newNode);
    }
  });

  if (currentRoot) {
    roots.push(currentRoot);
  }

  if (roots.length === 0) {
    throw new Error("No valid trace found");
  }

  return roots;
};

const TraceNodeComponent: React.FC<{
  node: TraceNode;
  expandedDepth: number;
  maxExpandedDepth: number;
  setMaxExpandedDepth: React.Dispatch<React.SetStateAction<number>>;
  allNodes: TraceNode[];
}> = ({
  node,
  expandedDepth,
  maxExpandedDepth,
  setMaxExpandedDepth,
  allNodes,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const recalculateMaxDepth = useCallback(() => {
    const maxDepth = Math.max(
      ...allNodes
        .filter(
          (n) =>
            n.depth <= expandedDepth || (n.depth === node.depth && isExpanded)
        )
        .map((n) => n.depth)
    );
    setMaxExpandedDepth(maxDepth);
  }, [allNodes, expandedDepth, isExpanded, node.depth, setMaxExpandedDepth]);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    recalculateMaxDepth();
  };

  const opacity =
    node.depth === maxExpandedDepth
      ? 1
      : Math.max(0.5, 1 - (maxExpandedDepth - node.depth) * 0.2);

  const buttonStyle = {
    opacity: opacity,
  };

  const getTextColor = () => {
    if (node.content.startsWith("←")) {
      return node.content.startsWith("← [Revert]")
        ? styles.redText
        : styles.greenText;
    }
    return isExpanded ? styles.whiteText : styles.whiteAlphaText;
  };

  return (
    <div className={styles.nodeContainer}>
      <button
        onClick={toggleExpand}
        className={`${styles.nodeButton} ${isExpanded ? styles.expanded : ""}`}
        style={buttonStyle}
      >
        {node.children.length > 0 && (
          <span className={styles.chevron}>{isExpanded ? "▼" : "▶"}</span>
        )}
        <span className={`${styles.nodeContent} ${getTextColor()}`}>
          {node.content}
        </span>
      </button>
      {isExpanded && node.children.length > 0 && (
        <div className={styles.childrenContainer}>
          {node.children.map((child, index) => (
            <TraceNodeComponent
              key={index}
              node={child}
              expandedDepth={node.depth + 1}
              maxExpandedDepth={maxExpandedDepth}
              setMaxExpandedDepth={setMaxExpandedDepth}
              allNodes={allNodes}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const App = ({ traceData }: { traceData: string }) => {
  const [treeData] = useState(() => parseTrace(traceData));
  const [maxExpandedDepth, setMaxExpandedDepth] = useState(0);
  const [allNodes] = useState(() => {
    const flattenTree = (nodes: TraceNode[]): TraceNode[] =>
      nodes.flatMap((node: TraceNode) => [node, ...flattenTree(node.children)]);
    return flattenTree(treeData);
  });

  return (
    <div className={styles.appContainer}>
      <h1 className={styles.heading}>Forge Stack Tracer UI</h1>
      {treeData.length > 0 && (
        <div className={styles.traceContainer}>
          {treeData.map((root, index) => (
            <TraceNodeComponent
              key={index}
              node={root}
              expandedDepth={0}
              maxExpandedDepth={maxExpandedDepth}
              setMaxExpandedDepth={setMaxExpandedDepth}
              allNodes={allNodes}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
