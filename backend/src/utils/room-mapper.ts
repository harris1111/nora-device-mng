import type { RoomNode } from '../generated/prisma/client.js';

type RoomNodeWithCount = RoomNode & { _count?: { devices: number }; children?: RoomNodeWithCount[] };

export interface RoomNodeResponse {
  id: string;
  name: string;
  code: string | null;
  description: string;
  parentId: string | null;
  path: string;
  status: string;
  deviceCount: number;
  children: RoomNodeResponse[];
  createdAt: string;
  updatedAt: string;
}

export function mapRoomNode(node: RoomNodeWithCount, children: RoomNodeResponse[] = []): RoomNodeResponse {
  return {
    id: node.id,
    name: node.name,
    code: node.code ?? null,
    description: node.description,
    parentId: node.parentId ?? null,
    path: node.path,
    status: node.status,
    deviceCount: node._count?.devices ?? 0,
    children,
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
  };
}

export function mapFlatRoomNode(node: RoomNodeWithCount): Omit<RoomNodeResponse, 'children'> & { children: undefined } {
  return {
    id: node.id,
    name: node.name,
    code: node.code ?? null,
    description: node.description,
    parentId: node.parentId ?? null,
    path: node.path,
    status: node.status,
    deviceCount: node._count?.devices ?? 0,
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
    children: undefined,
  };
}

export function buildTree(nodes: RoomNodeWithCount[]): RoomNodeResponse[] {
  const map = new Map<string, RoomNodeWithCount>();
  for (const n of nodes) map.set(n.id, n);

  const roots: RoomNodeWithCount[] = [];
  const childrenByParent = new Map<string, RoomNodeWithCount[]>();

  for (const n of nodes) {
    if (n.parentId) {
      const list = childrenByParent.get(n.parentId) ?? [];
      list.push(n);
      childrenByParent.set(n.parentId, list);
    } else {
      roots.push(n);
    }
  }

  function buildSubtree(node: RoomNodeWithCount): RoomNodeResponse {
    const childNodes = childrenByParent.get(node.id) ?? [];
    return mapRoomNode(node, childNodes.map(buildSubtree));
  }

  return roots.map(buildSubtree);
}
