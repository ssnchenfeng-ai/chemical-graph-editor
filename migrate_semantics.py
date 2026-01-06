import os
import json

# 配置路径
DATA_DIR = './src/graph/cells/data'

# 语义映射规则
# 格式: "旧Region字符串": ("Chamber", "Phase")
MAPPING_RULES = {
    "ShellSide": ("ShellSide", "Mix"), # 默认混合相
    "ShellSide:Vapor": ("ShellSide", "Vapor"),
    "ShellSide:Liquid": ("ShellSide", "Liquid"),
    "TubeSide": ("TubeSide", "Mix"),
    "TubeSide:Vapor": ("TubeSide", "Vapor"),
    "TubeSide:Liquid": ("TubeSide", "Liquid"),
    "InnerVessel": ("InnerVessel", "Liquid"), # 默认釜内为液相
    "Jacket": ("Jacket", "Liquid"),
    "UpperSaltChannel": ("Jacket", "Liquid"), # 归一化为夹套
    "LowerSaltChannel": ("Jacket", "Liquid"),
    "ControlSignal": ("Actuator", "Signal"),
    "Signal": ("Instrument", "Signal"),
    "Connector": ("Connector", "None")
}

def migrate_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        try:
            content = json.load(f)
        except json.JSONDecodeError:
            print(f"❌ Error decoding {filepath}")
            return

    modified = False
    
    if 'ports' in content and 'items' in content['ports']:
        for item in content['ports']['items']:
            data = item.get('data', {})
            old_region = data.get('region')
            
            # 如果已经有 chamber 字段，跳过
            if 'chamber' in data:
                continue

            if old_region:
                # 1. 尝试精确匹配
                if old_region in MAPPING_RULES:
                    chamber, phase = MAPPING_RULES[old_region]
                # 2. 尝试冒号分割解析
                elif ':' in old_region:
                    parts = old_region.split(':')
                    chamber = parts[0]
                    phase = parts[1]
                else:
                    # 3. 兜底策略
                    chamber = old_region
                    phase = "Mix"
                
                # 更新数据
                data['chamber'] = chamber
                data['phase'] = phase
                # 我们保留 region 字段以防代码其他地方报错，但在新逻辑中不再使用它
                # data['region'] = old_region 
                modified = True

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(content, f, indent=2, ensure_ascii=False)
        print(f"✅ Migrated: {filepath}")
    else:
        print(f"⏭️  Skipped: {filepath}")

def main():
    if not os.path.exists(DATA_DIR):
        print(f"Directory not found: {DATA_DIR}")
        return

    files = [f for f in os.listdir(DATA_DIR) if f.endswith('.json')]
    print(f"Found {len(files)} JSON files. Starting migration...")
    
    for filename in files:
        migrate_file(os.path.join(DATA_DIR, filename))

if __name__ == '__main__':
    main()