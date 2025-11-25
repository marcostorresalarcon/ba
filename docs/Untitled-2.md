- Si tiene la propiedad size, el precio se calcula por el tamaño seleccionado. Ejemplo: underCabinetPlugMolds: [1000.00, 1400.00, 1800.00], si el tamaño es small, el precio es 1000.00, si el tamaño es medium, el precio es 1400.00, si el tamaño es large, el precio es 1800.00.
- Si la formula es "Selection Price/UNIT * PRICE", el precio se calcula por el precio de la selección. Ejemplo: smoothCeilings, price: [7.0, 8.0, 8.0], si el usuario selecciona popcorn, el precio es 7.0 * UNIT, si el usuario selecciona stomped, el precio es 8.0 * UNIT, si el usuario selecciona orange peel, el precio es 8.0 * UNIT .
-Si la formula es "Selection Price", el precio se calcula por el precio de la selección. Ejemplo: baseboards, price: [4.5, 6.0, 8.0], si el usuario selecciona 3 1/2", el precio es 4.5 si el usuario selecciona 5 1/4", el precio es 6.0, si el usuario selecciona 7 1/4", el precio es 8.0 .






RENDERIZADO: 

- Si el element es radioButton y la formula es "UNIT * PRICE" ó "Selection Price/UNIT * PRICE", si el usuario selecciona yes debe aparecer el input de cantidad. 


ELEMENTOS PARA EL BACKEND: 

- Si el element es radioButton y la formula es "UNIT * PRICE", es de tipo number. 
- Si hay elementos con nombres iguales, solo debe haber uno, y tiene que incluir la propiedad experience.
- Si el element tiene la propiedad size, se debe de agregar la propiedad size (small, medium, large).