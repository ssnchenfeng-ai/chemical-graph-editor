import neo4j from 'neo4j-driver';

// ★★★ 请在这里修改你的数据库密码 ★★★
const driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'CGrx2526') 
);

export const runCypher = async (cypher: string, params = {}) => {
  const session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } catch (error) {
    console.error('Neo4j Execution Error:', error);
    throw error;
  } finally {
    await session.close();
  }
};

export default driver;