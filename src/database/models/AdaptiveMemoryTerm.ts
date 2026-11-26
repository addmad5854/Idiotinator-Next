import {Model} from '@nozbe/watermelondb';
import {field} from '@nozbe/watermelondb/decorators';
export default class AdaptiveMemoryTerm extends Model {
 static table='adaptive_memory_terms';
 @field('term') term!:string;
 @field('memory_id') memoryId!:string;
}
