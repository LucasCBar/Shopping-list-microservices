import { JsonDatabase } from '../../../shared/JsonDatabase';
import type { Item } from '../models/item.model';

const db = new JsonDatabase<Item>('./data/items.json');

export const readItems = () => db.read();
export const writeItems = (data: Item[]) => db.write(data);
