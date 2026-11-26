import {Model} from '@nozbe/watermelondb';
import {field} from '@nozbe/watermelondb/decorators';
export default class AdaptiveMemory extends Model {
  static table = 'adaptive_memories';
  @field('memory_id') memoryId!: string;
  @field('payload') payload!: string;
}
