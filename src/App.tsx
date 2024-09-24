import React, { useCallback, useEffect, useState } from "react";
import styles from "./App.module.css";

interface TraceNode {
  content: string;
  children: TraceNode[];
  depth: number;
}

interface FunctionCall {
  functionName: string;
  rawArgs: (string | string[])[];
}

const formatBigInt = (value: bigint): string => {
  const absValue = value < 0n ? -value : value;
  if (absValue < 1000000n) {
    return value.toString();
  }
  let exponent = 0;
  let tempValue = absValue;
  while (tempValue >= 10n) {
    tempValue /= 10n;
    exponent++;
  }
  const sign = value < 0n ? "-" : "";
  return `${value.toString()} [${sign}${tempValue.toString()}e${exponent}]`;
};

const formatValue = (value: string | string[]): string => {
  if (Array.isArray(value)) {
    return `(${value.map(formatValue).join(", ")})`;
  }

  // Try to parse as BigInt for large number formatting
  try {
    const bigIntValue = BigInt(value);
    return formatBigInt(bigIntValue);
  } catch {
    // If it's not a valid BigInt, return the original value
    return value;
  }
};

const formatFunctionCall = (data: FunctionCall): string => {
  const formattedArgs = data.rawArgs.map(formatValue).join(", ");
  return `${data.functionName}(${formattedArgs})`;
};

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

const decodeNodeContent = async (content: string): Promise<string> => {
  let res = content; // Default to original content

  // Eg: [140320] 0x39BF2eFF94201cfAA471932655404F63315147a4::5a6bcfda(0000)
  try {
    const splitContent = content.split("::");
    const firstHalf = splitContent[0];
    if (splitContent.length === 2) {
      const functionSelector = splitContent[1].split("(")[0];
      const isValidFunctionSelector =
        functionSelector.length === 8 &&
        /^[0-9a-fA-F]+$/.test(functionSelector);

      if (!isValidFunctionSelector) {
        return content;
      }

      const functionParams = splitContent[1].split("(")[1].split(")")[0];
      const calldata = `0x${functionSelector}${functionParams}`;
      const response = await fetch(
        "https://swiss-knife.xyz/api/calldata/decoder-recursive",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ calldata }),
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      res = `${firstHalf}::${formatFunctionCall(data)}`;
    }
  } catch (error) {
    console.error("Error decoding node content:", error);
    // Return original content if decoding fails
    return content;
  }

  return res;
};

const decodeNodeRecursively = async (node: TraceNode): Promise<TraceNode> => {
  const decodedContent = await decodeNodeContent(node.content);
  const decodedChildren = await Promise.all(
    node.children.map(decodeNodeRecursively)
  );
  return {
    ...node,
    content: decodedContent || node.content, // Use original content if decoded is empty
    children: decodedChildren,
  };
};

const Footer: React.FC = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <p>
          Powered by:{" "}
          <a
            href="https://calldata.swiss-knife.xyz/decoder"
            target="_blank"
            rel="noopener noreferrer"
          >
            Swiss-Knife.xyz Calldata Decoder
          </a>
        </p>
        <p>
          Built by:{" "}
          <a
            href="https://apoorv.xyz"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apoorv Lathey
          </a>
        </p>
      </div>
    </footer>
  );
};

const App = ({ traceData }: { traceData: string }) => {
  const [treeData, setTreeData] = useState<TraceNode[]>();
  const [maxExpandedDepth, setMaxExpandedDepth] = useState(0);
  const [allNodes, setAllNodes] = useState<TraceNode[]>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const decodeAllNodes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const _treeData = parseTrace(traceData);
      // Set initial tree data to render something instantly
      setTreeData(_treeData);

      // Decode all nodes recursively
      const decodedNodes = await Promise.all(
        _treeData.map(decodeNodeRecursively)
      );
      setTreeData(decodedNodes);
    } catch (err) {
      console.error("Error decoding nodes:", err);
      setError(
        "An error occurred while decoding the trace data. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }, [traceData]);

  useEffect(() => {
    decodeAllNodes();
  }, [traceData, decodeAllNodes]);

  useEffect(() => {
    if (treeData) {
      const flattenTree = (nodes: TraceNode[]): TraceNode[] =>
        nodes.flatMap((node: TraceNode) => [
          node,
          ...flattenTree(node.children),
        ]);
      setAllNodes(flattenTree(treeData));
    }
  }, [treeData]);

  const renderContent = () => {
    if (isLoading) {
      return <div className={styles.loadingMessage}>Loading trace data...</div>;
    }

    if (error) {
      return <div className={styles.errorMessage}>{error}</div>;
    }

    if (treeData && treeData.length > 0 && allNodes) {
      return (
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
      );
    }

    return null;
  };

  return (
    <div className={styles.appWrapper}>
      <div className={styles.appContainer}>
        <h1 className={styles.heading}>Forge Stack Tracer UI</h1>
        {renderContent()}
      </div>
      <Footer />
    </div>
  );
};

export default App;
