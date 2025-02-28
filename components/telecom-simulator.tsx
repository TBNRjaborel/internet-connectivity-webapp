"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Zap, Network, RefreshCw } from "lucide-react"

// Define types for our graph
type Node = {
  id: string
  label: string
  x: number
  y: number
  type: "city" | "barangay" | "hub"
  isArticulationPoint?: boolean
}

type Edge = {
  source: string
  target: string
  isBridge?: boolean
  isActive: boolean
  isRecovery?: boolean
}

type Graph = {
  nodes: Node[]
  edges: Edge[]
}

// Initial graph representing telecom infrastructure in rural Philippines
const initialGraph: Graph = {
  nodes: [
    { id: "1", label: "Cebu Hub", x: 300, y: 100, type: "hub" },
    { id: "2", label: "Cebu City", x: 200, y: 180, type: "city" },
    { id: "3", label: "Mandaue Hub", x: 150, y: 250, type: "hub" },
    { id: "4", label: "Banilad", x: 100, y: 320, type: "city" },
    { id: "5", label: "Subangdaku", x: 200, y: 320, type: "city" },
    { id: "6", label: "Nau", x: 250, y: 380, type: "barangay" },
    { id: "7", label: "Baco", x: 150, y: 380, type: "barangay" },
    { id: "8", label: "Palawan Hub", x: 50, y: 200, type: "hub" },
    { id: "9", label: "El Nido", x: 30, y: 280, type: "city" },
    { id: "10", label: "Puerto Princesa", x: 80, y: 350, type: "city" },
    { id: "11", label: "Quezon Hub", x: 400, y: 180, type: "hub" },
    { id: "12", label: "Lucena", x: 450, y: 250, type: "city" },
    { id: "13", label: "Tayabas", x: 500, y: 300, type: "barangay" },
  ],
  edges: [
    { source: "1", target: "2", isActive: true },
    { source: "1", target: "11", isActive: true },
    { source: "2", target: "3", isActive: true },
    { source: "2", target: "8", isActive: true },
    { source: "3", target: "4", isActive: true },
    { source: "3", target: "5", isActive: true },
    { source: "4", target: "7", isActive: true },
    { source: "5", target: "6", isActive: true },
    { source: "5", target: "7", isActive: true },
    { source: "8", target: "9", isActive: true },
    { source: "8", target: "10", isActive: true },
    { source: "11", target: "12", isActive: true },
    { source: "12", target: "13", isActive: true },
  ],
}

export default function TelecomSimulator() {
  const [graph, setGraph] = useState<Graph>(initialGraph)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [targetNode, setTargetNode] = useState<string | null>(null)
  const [algorithmResult, setAlgorithmResult] = useState<string[]>([])
  const [path, setPath] = useState<string[]>([])
  const [bridges, setBridges] = useState<Edge[]>([])
  const [articulationPoints, setArticulationPoints] = useState<Node[]>([])
  const [mode, setMode] = useState<"normal" | "failure">("normal")
  const [recoveryEdges, setRecoveryEdges] = useState<Edge[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Reset the simulation
  const resetSimulation = () => {
    setGraph({
      nodes: initialGraph.nodes.map((node) => ({
        ...node,
        isArticulationPoint: false,
      })),
      edges: initialGraph.edges.map((edge) => ({
        ...edge,
        isBridge: false,
        isActive: true,
      })),
    })
    setSelectedNode(null)
    setTargetNode(null)
    setAlgorithmResult([])
    setPath([])
    setBridges([])
    setArticulationPoints([])
    setRecoveryEdges([])
    setMode("normal")
  }

  // Toggle edge failure
  const toggleEdge = (sourceId: string, targetId: string) => {
    setGraph((prevGraph) => ({
      ...prevGraph,
      edges: prevGraph.edges.map((edge) => {
        if (
          (edge.source === sourceId && edge.target === targetId) ||
          (edge.source === targetId && edge.target === sourceId)
        ) {
          return { ...edge, isActive: !edge.isActive }
        }
        return edge
      }),
    }))
    // Clear previous results when topology changes
    setPath([])
    setAlgorithmResult([])
  }

  // Run DFS to find bridges and articulation points
  const runDFS = () => {
    // Reset previous results
    setPath([])
    setAlgorithmResult([])

    const visited: Record<string, boolean> = {}
    const discoveryTime: Record<string, number> = {}
    const lowTime: Record<string, number> = {}
    const parent: Record<string, string | null> = {}
    const foundBridges: Edge[] = []
    const foundArticulationPoints: Set<string> = new Set()
    let time = 0

    // Only consider active edges
    const activeEdges = graph.edges.filter((edge) => edge.isActive)

    // Build adjacency list
    const adjList: Record<string, string[]> = {}
    graph.nodes.forEach((node) => {
      adjList[node.id] = []
    })

    activeEdges.forEach((edge) => {
      adjList[edge.source].push(edge.target)
      adjList[edge.target].push(edge.source)
    })

    // DFS function
    const dfsVisit = (u: string, isRoot: boolean) => {
      const result: string[] = []
      result.push(`Visiting ${getNodeLabel(u)}`)

      visited[u] = true
      time += 1
      discoveryTime[u] = time
      lowTime[u] = time
      let childCount = 0

      for (const v of adjList[u]) {
        if (!visited[v]) {
          childCount++
          parent[v] = u
          result.push(`Exploring edge from ${getNodeLabel(u)} to ${getNodeLabel(v)}`)

          const childResults = dfsVisit(v, false)
          result.push(...childResults)

          lowTime[u] = Math.min(lowTime[u], lowTime[v])

          // Check for articulation point
          if (!isRoot && lowTime[v] >= discoveryTime[u]) {
            result.push(`Found articulation point: ${getNodeLabel(u)}`)
            foundArticulationPoints.add(u)
          }

          // Check for bridge
          if (lowTime[v] > discoveryTime[u]) {
            result.push(`Found bridge: ${getNodeLabel(u)} - ${getNodeLabel(v)}`)
            const bridgeEdge = activeEdges.find(
              (edge) => (edge.source === u && edge.target === v) || (edge.source === v && edge.target === u),
            )
            if (bridgeEdge) {
              foundBridges.push(bridgeEdge)
            }
          }
        } else if (v !== parent[u]) {
          lowTime[u] = Math.min(lowTime[u], discoveryTime[v])
          result.push(`Back edge from ${getNodeLabel(u)} to ${getNodeLabel(v)}`)
        }
      }

      // Special case for root
      if (isRoot && childCount > 1) {
        result.push(`Root is an articulation point: ${getNodeLabel(u)}`)
        foundArticulationPoints.add(u)
      }

      return result
    }

    // Start DFS from the first node
    const startNode = graph.nodes[0].id
    const dfsResults = dfsVisit(startNode, true)

    // Update state with results
    setAlgorithmResult(dfsResults)

    // Update bridges in the graph
    const updatedEdges = graph.edges.map((edge) => ({
      ...edge,
      isBridge: foundBridges.some(
        (bridge) =>
          (bridge.source === edge.source && bridge.target === edge.target) ||
          (bridge.source === edge.target && bridge.target === edge.source),
      ),
    }))

    // Update articulation points in the graph
    const updatedNodes = graph.nodes.map((node) => ({
      ...node,
      isArticulationPoint: foundArticulationPoints.has(node.id),
    }))

    setGraph({
      nodes: updatedNodes,
      edges: updatedEdges,
    })

    setBridges(foundBridges)
    setArticulationPoints(updatedNodes.filter((node) => node.isArticulationPoint))
  }

  // Run BFS to find shortest path
  const runBFS = () => {
    if (!selectedNode || !targetNode) {
      setAlgorithmResult(["Please select both source and target nodes"])
      return
    }

    // Reset previous results
    setAlgorithmResult([])

    const visited: Record<string, boolean> = {}
    const queue: string[] = []
    const prev: Record<string, string | null> = {}
    const result: string[] = []

    // Only consider active edges
    const activeEdges = graph.edges.filter((edge) => edge.isActive)

    // Build adjacency list
    const adjList: Record<string, string[]> = {}
    graph.nodes.forEach((node) => {
      adjList[node.id] = []
    })

    activeEdges.forEach((edge) => {
      adjList[edge.source].push(edge.target)
      adjList[edge.target].push(edge.source)
    })

    // Initialize BFS
    queue.push(selectedNode)
    visited[selectedNode] = true
    prev[selectedNode] = null

    result.push(`Starting BFS from ${getNodeLabel(selectedNode)}`)

    // BFS traversal
    while (queue.length > 0) {
      const current = queue.shift()!
      result.push(`Visiting ${getNodeLabel(current)}`)

      if (current === targetNode) {
        result.push(`Found target: ${getNodeLabel(targetNode)}`)
        break
      }

      for (const neighbor of adjList[current]) {
        if (!visited[neighbor]) {
          queue.push(neighbor)
          visited[neighbor] = true
          prev[neighbor] = current
          result.push(`Discovered ${getNodeLabel(neighbor)} from ${getNodeLabel(current)}`)
        }
      }
    }

    // Reconstruct path if target was found
    if (visited[targetNode]) {
      const shortestPath: string[] = []
      let current: string | null = targetNode

      while (current !== null) {
        shortestPath.unshift(current)
        current = prev[current]
      }

      result.push(`Shortest path: ${shortestPath.map(getNodeLabel).join(" → ")}`)
      setPath(shortestPath)
    } else {
      result.push(`No path exists from ${getNodeLabel(selectedNode)} to ${getNodeLabel(targetNode)}`)
      setPath([])
    }

    setAlgorithmResult(result)
  }

  // Find disconnected nodes and reconnect them to the nearest available node
  const recoverNetwork = () => {
    // Reset previous recovery edges
    setRecoveryEdges([])
    setAlgorithmResult([])

    const result: string[] = []
    result.push("Starting network recovery process...")

    // Only consider active edges
    const activeEdges = graph.edges.filter((edge) => edge.isActive)

    // Build adjacency list
    const adjList: Record<string, string[]> = {}
    graph.nodes.forEach((node) => {
      adjList[node.id] = []
    })

    activeEdges.forEach((edge) => {
      adjList[edge.source].push(edge.target)
      adjList[edge.target].push(edge.source)
    })

    // Start from a hub node (assuming the first hub is the main source)
    const sourceNode = graph.nodes.find((node) => node.type === "hub")?.id || graph.nodes[0].id

    // Run BFS to find all reachable nodes from the source
    const visited: Record<string, boolean> = {}
    const queue: string[] = []

    queue.push(sourceNode)
    visited[sourceNode] = true

    while (queue.length > 0) {
      const current = queue.shift()!

      for (const neighbor of adjList[current]) {
        if (!visited[neighbor]) {
          queue.push(neighbor)
          visited[neighbor] = true
        }
      }
    }

    // Find disconnected nodes
    const disconnectedNodes = graph.nodes.filter((node) => !visited[node.id])

    if (disconnectedNodes.length === 0) {
      result.push("All nodes are connected. No recovery needed.")
      setAlgorithmResult(result)
      return
    }

    result.push(
      `Found ${disconnectedNodes.length} disconnected nodes: ${disconnectedNodes.map((n) => n.label).join(", ")}`,
    )

    // For each disconnected node, find the closest connected node to connect to
    const newRecoveryEdges: Edge[] = []

    disconnectedNodes.forEach((disconnectedNode) => {
      // Find all connected nodes
      const connectedNodes = graph.nodes.filter((node) => visited[node.id])

      // Find the closest connected node (using Euclidean distance as a simple metric)
      let closestNode = connectedNodes[0]
      let minDistance = Number.MAX_VALUE

      connectedNodes.forEach((connectedNode) => {
        const dx = connectedNode.x - disconnectedNode.x
        const dy = connectedNode.y - disconnectedNode.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < minDistance) {
          minDistance = distance
          closestNode = connectedNode
        }
      })

      // Create a recovery edge
      const recoveryEdge: Edge = {
        source: disconnectedNode.id,
        target: closestNode.id,
        isActive: true,
        isRecovery: true,
      }

      newRecoveryEdges.push(recoveryEdge)
      result.push(`Reconnecting ${disconnectedNode.label} to ${closestNode.label}`)
    })

    setRecoveryEdges(newRecoveryEdges)
    setAlgorithmResult(result)
  }

  // Helper to get node label by id
  const getNodeLabel = (id: string): string => {
    const node = graph.nodes.find((n) => n.id === id)
    return node ? node.label : id
  }

  // Draw the graph on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw edges
    graph.edges.forEach((edge) => {
      const sourceNode = graph.nodes.find((n) => n.id === edge.source)
      const targetNode = graph.nodes.find((n) => n.id === edge.target)

      if (sourceNode && targetNode) {
        ctx.beginPath()
        ctx.moveTo(sourceNode.x, sourceNode.y)
        ctx.lineTo(targetNode.x, targetNode.y)

        // Style based on edge properties
        if (!edge.isActive) {
          ctx.strokeStyle = "#ff0000"
          ctx.setLineDash([5, 3])
        } else if (edge.isBridge) {
          ctx.strokeStyle = "#ff9900"
          ctx.lineWidth = 3
          ctx.setLineDash([])
        } else if (
          path.includes(edge.source) &&
          path.includes(edge.target) &&
          (path[path.indexOf(edge.source)] === edge.target || path[path.indexOf(edge.target)] === edge.source)
        ) {
          ctx.strokeStyle = "#00cc00"
          ctx.lineWidth = 3
          ctx.setLineDash([])
        } else {
          ctx.strokeStyle = "#666666"
          ctx.lineWidth = 2
          ctx.setLineDash([])
        }

        ctx.stroke()
        ctx.setLineDash([])
        ctx.lineWidth = 2
      }
    })

    // Draw recovery edges
    recoveryEdges.forEach((edge) => {
      const sourceNode = graph.nodes.find((n) => n.id === edge.source)
      const targetNode = graph.nodes.find((n) => n.id === edge.target)

      if (sourceNode && targetNode) {
        ctx.beginPath()
        ctx.moveTo(sourceNode.x, sourceNode.y)
        ctx.lineTo(targetNode.x, targetNode.y)

        // Style for recovery edges
        ctx.strokeStyle = "#8b5cf6" // Purple color for recovery edges
        ctx.lineWidth = 2
        ctx.setLineDash([8, 4]) // Dashed line for recovery edges

        ctx.stroke()
        ctx.setLineDash([])
        ctx.lineWidth = 2
      }
    })

    // Draw nodes
    graph.nodes.forEach((node) => {
      ctx.beginPath()

      // Different node types have different styles
      if (node.type === "hub") {
        ctx.rect(node.x - 15, node.y - 15, 30, 30)
      } else {
        ctx.arc(node.x, node.y, node.type === "city" ? 12 : 8, 0, Math.PI * 2)
      }

      // Style based on node properties
      if (node.id === selectedNode) {
        ctx.fillStyle = "#3b82f6"
      } else if (node.id === targetNode) {
        ctx.fillStyle = "#10b981"
      } else if (node.isArticulationPoint) {
        ctx.fillStyle = "#f97316"
      } else if (node.type === "hub") {
        ctx.fillStyle = "#8b5cf6"
      } else if (node.type === "city") {
        ctx.fillStyle = "#6b7280"
      } else {
        ctx.fillStyle = "#94a3b8"
      }

      ctx.fill()

      // Draw node label
      ctx.fillStyle = "#000000"
      ctx.font = "12px Arial"
      ctx.textAlign = "center"
      ctx.fillText(node.label, node.x, node.y + 25)
    })
  }, [graph, selectedNode, targetNode, path, recoveryEdges])

  // Handle canvas click to select nodes
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()

    // Calculate scale factors
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    // Adjust coordinates based on scaling and offset
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    // Increase hit detection radius for better touch/click accuracy
    const hitRadius = 20 // Increased from previous implicit radius

    // Find clicked node with improved hit detection
    const clickedNode = graph.nodes.find((node) => {
      const dx = node.x - x
      const dy = node.y - y
      return dx * dx + dy * dy <= hitRadius * hitRadius
    })

    if (clickedNode) {
      if (!selectedNode) {
        setSelectedNode(clickedNode.id)
      } else if (!targetNode) {
        if (clickedNode.id !== selectedNode) {
          setTargetNode(clickedNode.id)
        }
      } else {
        setSelectedNode(clickedNode.id)
        setTargetNode(null)
        setPath([])
      }
    }
  }

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const canvas = canvasRef.current
        const parent = canvas.parentElement
        if (parent) {
          // Maintain aspect ratio while fitting to container
          const containerWidth = parent.clientWidth
          const scale = containerWidth / 600 // 600 is our base width
          canvas.style.width = `${containerWidth}px`
          canvas.style.height = `${450 * scale}px` // 450 is our base height
        }
      }
    }

    handleResize() // Initial resize
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <div className="w-full max-w-6xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-4 bg-slate-100 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Network Visualization</h2>
              <p className="text-sm text-gray-500">
                {mode === "normal" ? "View network topology" : "Simulate infrastructure failures"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant={mode === "normal" ? "default" : "outline"} size="sm" onClick={() => setMode("normal")}>
                Normal
              </Button>
              <Button
                variant={mode === "failure" ? "destructive" : "outline"}
                size="sm"
                onClick={() => setMode("failure")}
              >
                Failure Mode
              </Button>
              <Button variant="outline" size="sm" onClick={resetSimulation}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            </div>
          </div>

          <div className="relative">
            <canvas
              ref={canvasRef}
              width={600}
              height={450}
              onClick={handleCanvasClick}
              className="w-full h-auto cursor-pointer touch-none"
              style={{ imageRendering: "crisp-edges" }}
            />

            <div className="absolute top-2 right-2 bg-white/90 p-2 rounded-lg shadow-sm">
              {bridges.length > 0 && (
                <div className="text-xs flex items-center mb-1">
                  <div className="w-3 h-1 bg-[#ff9900] mr-1"></div>
                  <span>Bridge</span>
                </div>
              )}
              {articulationPoints.length > 0 && (
                <div className="text-xs flex items-center mb-1">
                  <div className="w-3 h-3 rounded-full bg-[#f97316] mr-1"></div>
                  <span>Articulation Point</span>
                </div>
              )}
              {path.length > 0 && (
                <div className="text-xs flex items-center mb-1">
                  <div className="w-3 h-1 bg-[#00cc00] mr-1"></div>
                  <span>Shortest Path</span>
                </div>
              )}
              {recoveryEdges.length > 0 && (
                <div className="text-xs flex items-center mb-1">
                  <div className="w-3 h-1 bg-[#8b5cf6] mr-1 border-t border-dashed"></div>
                  <span>Recovery Connection</span>
                </div>
              )}
              <div className="text-xs flex items-center mb-1">
                <div className="w-3 h-3 rounded-full bg-[#8b5cf6] mr-1"></div>
                <span>Hub</span>
              </div>
              <div className="text-xs flex items-center mb-1">
                <div className="w-3 h-3 rounded-full bg-[#6b7280] mr-1"></div>
                <span>City</span>
              </div>
              <div className="text-xs flex items-center">
                <div className="w-3 h-3 rounded-full bg-[#94a3b8] mr-1"></div>
                <span>Barangay</span>
              </div>
            </div>
          </div>

          {mode === "failure" && (
            <div className="p-4 bg-red-50 border-t border-red-200">
              <h3 className="text-sm font-medium flex items-center">
                <AlertCircle className="h-4 w-4 mr-1 text-red-500" />
                Failure Simulation Mode
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                Click on the table below to toggle infrastructure failures and test network resilience
              </p>

              <div className="mt-2 max-h-32 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-1 text-left">Connection</th>
                      <th className="p-1 text-center">Status</th>
                      <th className="p-1 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {graph.edges.map((edge, idx) => (
                      <tr key={idx} className="border-t border-gray-200">
                        <td className="p-1">
                          {getNodeLabel(edge.source)} → {getNodeLabel(edge.target)}
                        </td>
                        <td className="p-1 text-center">
                          {edge.isActive ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              Failed
                            </Badge>
                          )}
                        </td>
                        <td className="p-1 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => toggleEdge(edge.source, edge.target)}
                          >
                            Toggle
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Algorithm Controls</CardTitle>
              <CardDescription>Run graph algorithms to analyze the network</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center">
                    <Network className="h-4 w-4 mr-1" />
                    Network Analysis
                  </h3>
                  <Button onClick={runDFS} className="w-full mb-2" variant="default">
                    Run DFS (Find Critical Points)
                  </Button>
                  <Button onClick={recoverNetwork} className="w-full mb-2" variant="secondary">
                    Auto-Recover Network
                  </Button>
                  <p className="text-xs text-gray-500">Identifies bridges and articulation points in the network</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center">
                    <Zap className="h-4 w-4 mr-1" />
                    Path Finding
                  </h3>
                  <div className="text-xs mb-2">
                    {selectedNode ? (
                      <span>
                        Source: <Badge variant="secondary">{getNodeLabel(selectedNode)}</Badge>
                      </span>
                    ) : (
                      <span>Click on a node to select source</span>
                    )}
                    {selectedNode && !targetNode && (
                      <span className="block mt-1">Now click on another node to select target</span>
                    )}
                    {targetNode && (
                      <span className="block mt-1">
                        Target: <Badge variant="secondary">{getNodeLabel(targetNode)}</Badge>
                      </span>
                    )}
                  </div>
                  <Button onClick={runBFS} className="w-full" variant="default" disabled={!selectedNode || !targetNode}>
                    Run BFS (Find Shortest Path)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Results</CardTitle>
              <CardDescription>Algorithm execution details</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="log">
                <TabsList className="w-full">
                  <TabsTrigger value="log" className="flex-1">
                    Algorithm Log
                  </TabsTrigger>
                  <TabsTrigger value="summary" className="flex-1">
                    Summary
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="log" className="mt-2">
                  <div className="bg-slate-50 p-2 rounded text-xs h-[200px] overflow-y-auto">
                    {algorithmResult.length > 0 ? (
                      <ul className="space-y-1">
                        {algorithmResult.map((line, idx) => (
                          <li key={idx} className="border-b border-slate-100 pb-1">
                            {line}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 italic">Run an algorithm to see results</p>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="summary" className="mt-2">
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-medium">Critical Infrastructure</h3>
                      {bridges.length > 0 ? (
                        <div className="mt-1">
                          <p className="text-xs font-medium">Bridges (Critical Links):</p>
                          <ul className="text-xs list-disc pl-4">
                            {bridges.map((bridge, idx) => (
                              <li key={idx}>
                                {getNodeLabel(bridge.source)} ↔ {getNodeLabel(bridge.target)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 mt-1">No bridges identified</p>
                      )}

                      {articulationPoints.length > 0 ? (
                        <div className="mt-2">
                          <p className="text-xs font-medium">Articulation Points (Critical Hubs):</p>
                          <ul className="text-xs list-disc pl-4">
                            {articulationPoints.map((node, idx) => (
                              <li key={idx}>{node.label}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 mt-1">No articulation points identified</p>
                      )}
                    </div>

                    {path.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium">Shortest Path</h3>
                        <p className="text-xs mt-1">{path.map(getNodeLabel).join(" → ")}</p>
                        <p className="text-xs text-gray-500 mt-1">Path length: {path.length - 1} hops</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-lg shadow-md p-4">
        <h2 className="text-lg font-semibold mb-2">How to Use This Simulator</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <h3 className="font-medium mb-1">Network Analysis (DFS)</h3>
            <p className="text-gray-600">Click the "Run DFS" button to identify critical infrastructure components:</p>
            <ul className="list-disc pl-5 mt-1 text-gray-600">
              <li>Bridges (orange lines) - connections whose failure would disconnect parts of the network</li>
              <li>Articulation points (orange nodeswould disconnect parts of the network</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-1">Path Finding (BFS)</h3>
            <p className="text-gray-600">
              1. Click on a node to select it as the source
              <br />
              2. Click on another node to select it as the target
              <br />
              3. Click "Run BFS" to find the shortest path (green line)
            </p>
          </div>

          <div>
            <h3 className="font-medium mb-1">Failure Simulation</h3>
            <p className="text-gray-600">
              1. Click "Failure Mode" to enter simulation mode
              <br />
              2. Toggle connections on/off in the table to simulate infrastructure failures
              <br />
              3. Run DFS and BFS to analyze network resilience after failures
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-1">Network Recovery</h3>
            <p className="text-gray-600">
              1. Enter "Failure Mode" and disable some connections
              <br />
              2. Click "Auto-Recover Network" to automatically reconnect isolated nodes
              <br />
              3. Purple dashed lines show the new recovery connections
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

