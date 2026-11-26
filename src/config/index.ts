import heroRaw from '../../data/heroes.json';
import enemiesRaw from '../../data/enemies.json';
import wavesRaw from '../../data/waves.json';
import summonsRaw from '../../data/summons.json';
import passivesRaw from '../../data/passives.json';
import bondsRaw from '../../data/bonds.json';
import skillsRaw from '../../data/skills.json';
import levelsRaw from '../../data/levels.json';
import { buildConfig } from './validate';

/** 启动时校验一次；配置写错会直接抛出并指出文件与字段。 */
export const config = buildConfig({
  hero: heroRaw,
  enemies: enemiesRaw,
  waves: wavesRaw,
  summons: summonsRaw,
  passives: passivesRaw,
  bonds: bondsRaw,
  skills: skillsRaw,
  levels: levelsRaw,
});
