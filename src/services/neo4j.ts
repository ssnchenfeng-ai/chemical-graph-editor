import neo4j from 'neo4j-driver';

// ⚠️ 1. 请务必确认你的密码！
const YOUR_PASSWORD = 'CGrx2526'; 

const driver = neo4j.driver(
  'bolt://localhost:7687', 
  neo4j.auth.basic('neo4j', YOUR_PASSWORD),
  { 
    // ⚠️ 关键配置：关闭加密，否则浏览器会拦截 localhost 连接
    encrypted: 'ENCRYPTION_OFF', 
    // 禁用大整数转换，避免 JS 处理报错
    disableLosslessIntegers: true 
  }
);

export const runCypher = async (cypher: string, params = {}) => {
  const session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } catch (error) {
    console.error('❌ Cypher 执行错误:', error);
    throw error;
  } finally {
    await session.close();
  }
};

export const saveGraphData = async (nodes: any[], edges: any[]) => {
  const session = driver.session();
  const tx = session.beginTransaction();
  console.log('正在保存...', { nodes, edges }); // 方便调试

  try {
    // 1. 清理旧数据
    await tx.run(`MATCH (n:Equipment) DETACH DELETE n`);

    // 2. 批量创建节点
    if (nodes.length > 0) {
      await tx.run(
        `
        UNWIND $nodes AS n
        CREATE (e:Equipment {id: n.id})
        SET e.tag = n.label,
            e.type = n.type,
            e.spec = n.spec,
            e.x = n.x,
            e.y = n.y
        `,
        { nodes }
      );
    }

    // 3. 批量创建连线
    if (edges.length > 0) {
      await tx.run(
        `
        UNWIND $edges AS r
        MATCH (source:Equipment {id: r.source})
        MATCH (target:Equipment {id: r.target})
        CREATE (source)-[:PIPE {
          fromPort: r.sourcePort,
          toPort: r.targetPort
        }]->(target)
        `,
        { edges }
      );
    }

    await tx.commit();
    console.log('✅ 事务提交成功');
  } catch (error) {
    console.error('❌ 保存事务失败:', error);
    await tx.rollback();
    throw error;
  } finally {
    await session.close();
  }
};

// ... 之前的代码 (driver, saveGraphData 等)

/**
 * 加载全图数据
 * 返回格式符合 X6 的 fromJSON 要求
 */
export const loadGraphData = async () => {
  const session = driver.session();
  try {
    // 1. 查询所有节点
    const nodesResult = await session.run(`
      MATCH (n:Equipment)
      RETURN n.id as id, n.tag as label, n.type as type, n.spec as spec, n.x as x, n.y as y
    `);

    const nodes = nodesResult.records.map(record => {
      const type = record.get('type');
      // 映射数据库里的 type 到 X6 的 shape 名称
      let shape = 'rect'; // 默认值
      if (type === 'Reactor') shape = 'custom-reactor';
      else if (type === 'Pump') shape = 'custom-pump';
      else if (type === 'Valve') shape = 'custom-valve';

      return {
        id: record.get('id'),
        shape: shape,
        x: record.get('x'),
        y: record.get('y'),
        data: { 
          type: type, 
          spec: record.get('spec') 
        },
        attrs: {
          label: { text: record.get('label') }
        }
      };
    });

    // 2. 查询所有连线
    const edgesResult = await session.run(`
      MATCH (s:Equipment)-[r:PIPE]->(t:Equipment)
      RETURN s.id as source, t.id as target, r.fromPort as sourcePort, r.toPort as targetPort
    `);

    const edges = edgesResult.records.map(record => ({
      source: { cell: record.get('source'), port: record.get('sourcePort') },
      target: { cell: record.get('target'), port: record.get('targetPort') }
    }));

    return { nodes, edges };
  } catch (error) {
    console.error('❌ 加载失败:', error);
    throw error;
  } finally {
    await session.close();
  }
};

export default driver;